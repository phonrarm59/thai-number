
import os
import re
import uuid
import requests
import gspread
import json

from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from google.oauth2.service_account import Credentials


load_dotenv()

app = Flask(__name__)

# AI FOR THAI
API_KEY = os.getenv("AIFORTHAI_API_KEY")
API_URL = "https://api.aiforthai.in.th/lpr-v2"

# Google Sheets
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]


# เชื่อมต่อ Google Sheets

def connect_sheets():

    credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON")

    if credentials_json:
        # ใช้ Credentials จาก Vercel
        credentials_info = json.loads(credentials_json)

        credentials = Credentials.from_service_account_info(
            credentials_info,
            scopes=SCOPES
        )

    else:
        # ใช้ไฟล์ credentials.json บนเครื่องคอมพิวเตอร์
        credentials = Credentials.from_service_account_file(
            "credentials.json",
            scopes=SCOPES
        )

    client = gspread.authorize(credentials)

    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    vehicle_sheet = spreadsheet.worksheet("Vehicle_Data")
    history_sheet = spreadsheet.worksheet("Detection_History")

    return vehicle_sheet, history_sheet


# ปรับรูปแบบทะเบียนก่อนเปรียบเทียบ
def normalize_plate(plate):

    return re.sub(r"[\s-]", "", str(plate)).upper()


# ค้นหาทะเบียนใน Google Sheets
def find_vehicle(plate, vehicle_sheet):

    vehicles = vehicle_sheet.get_all_records()

    for vehicle in vehicles:

        saved_plate = vehicle.get("Plate_ID", "")

        if normalize_plate(saved_plate) == normalize_plate(plate):
            return vehicle

    return None


# บันทึกประวัติการตรวจสอบ
def add_detection(plate, province, status, image_name, history_sheet):

    now = datetime.now()

    row = [
        str(uuid.uuid4())[:8],
        plate,
        province,
        now.strftime("%d/%m/%Y"),
        now.strftime("%H:%M:%S"),
        status,
        image_name
    ]

    history_sheet.append_row(row)


# หน้าแรก
@app.route("/")
def home():

    return render_template("index.html")


# ตรวจจับป้ายทะเบียน
@app.route("/recognize", methods=["POST"])
def recognize():

    if not API_KEY:
        return jsonify({
            "success": False,
            "error": "ไม่พบ API Key"
        }), 500

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "ไม่พบรูปภาพ"
        }), 400

    image = request.files["image"]

    if image.filename == "":
        return jsonify({
            "success": False,
            "error": "กรุณาเลือกรูปภาพ"
        }), 400

    headers = {
        "Apikey": API_KEY
    }

    payload = {
        "crop": "1",
        "rotate": "1"
    }

    files = {
        "image": (
            image.filename,
            image.stream,
            image.mimetype or "application/octet-stream"
        )
    }

    try:

        # ส่งภาพไปยัง AI FOR THAI
        response = requests.post(
            API_URL,
            headers=headers,
            data=payload,
            files=files,
            timeout=60
        )

        # แสดงข้อมูลตอบกลับจาก AI ใน Terminal
        print("AI HTTP Status:", response.status_code)
        print("AI Response:", response.text[:500])

        # ตรวจสอบ HTTP Status
        response.raise_for_status()

        # ตรวจสอบว่ามีข้อมูลตอบกลับหรือไม่
        if not response.text.strip():

            return jsonify({
                "success": False,
                "error": "AI FOR THAI ไม่ได้ส่งข้อมูลกลับมา กรุณาลองใหม่"
            }), 502

        # แปลงข้อมูล JSON จาก AI
        try:
            result = response.json()

        except requests.exceptions.JSONDecodeError:

            print("AI JSON Error: ไม่สามารถแปลงข้อมูลเป็น JSON ได้")

            return jsonify({
                "success": False,
                "error": "AI FOR THAI ส่งข้อมูลไม่ถูกต้อง กรุณาลองใหม่"
            }), 502

        # ตรวจสอบผลลัพธ์
        if not isinstance(result, list) or not result:

            return jsonify({
                "success": False,
                "error": "ไม่พบป้ายทะเบียนในภาพ"
            }), 422

        plate = result[0].get("lpr")

        if not plate:

            return jsonify({
                "success": False,
                "error": "ไม่สามารถอ่านทะเบียนได้"
            }), 422

        # เชื่อมต่อ Google Sheets
        vehicle_sheet, history_sheet = connect_sheets()

        # ค้นหาทะเบียน
        vehicle = find_vehicle(plate, vehicle_sheet)

        if vehicle:

            status = "Registered"
            province = vehicle.get("Province", "")

        else:

            status = "Not Registered"
            province = ""

        # บันทึกประวัติ
        add_detection(
            plate,
            province,
            status,
            image.filename,
            history_sheet
        )

        return jsonify({
            "success": True,
            "plate": plate,
            "registered": vehicle is not None,
            "vehicle": vehicle
        })

    # กรณีเชื่อมต่อ API ไม่สำเร็จ
    except requests.exceptions.RequestException as error:

        print("AI API Error:", error)

        if error.response is not None:
            print("HTTP Status:", error.response.status_code)
            print("API Response:", error.response.text[:500])

        return jsonify({
            "success": False,
            "error": "ไม่สามารถเชื่อมต่อ AI FOR THAI ได้ กรุณาลองใหม่"
        }), 502

    # กรณีระบบหรือ Google Sheets มีปัญหา
    except Exception as error:

        print("System Error:", error)

        return jsonify({
            "success": False,
            "error": "เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets หรือระบบ"
        }), 500


# เพิ่มทะเบียนรถ
@app.route("/add_vehicle", methods=["POST"])
def add_vehicle():

    try:

        data = request.get_json(silent=True) or {}

        plate = data.get("plate", "").strip()
        province = data.get("province", "").strip()
        vehicle_type = data.get("vehicle_type", "").strip()
        owner = data.get("owner", "").strip()

        # ตรวจสอบข้อมูล
        if not all([plate, province, vehicle_type, owner]):

            return jsonify({
                "success": False,
                "error": "กรุณากรอกข้อมูลให้ครบทุกช่อง"
            }), 400

        vehicle_sheet, history_sheet = connect_sheets()

        # ตรวจสอบทะเบียนซ้ำ
        existing_vehicle = find_vehicle(plate, vehicle_sheet)

        if existing_vehicle:

            return jsonify({
                "success": False,
                "error": "ทะเบียนนี้มีอยู่ในระบบแล้ว"
            }), 409

        # เพิ่มข้อมูลลง Google Sheets
        register_date = datetime.now().strftime("%d/%m/%Y")

        vehicle_sheet.append_row([
            plate,
            province,
            vehicle_type,
            owner,
            register_date
        ])

        return jsonify({
            "success": True,
            "message": "บันทึกทะเบียนเรียบร้อยแล้ว"
        })

    except Exception as error:

        print("Add Vehicle Error:", error)

        return jsonify({
            "success": False,
            "error": "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่"
        }), 500


# ดึงประวัติการตรวจจับ
@app.route("/history", methods=["GET"])
def get_history():

    try:

        vehicle_sheet, history_sheet = connect_sheets()

        records = history_sheet.get_all_records()

        # เลือก 20 รายการล่าสุด
        latest_records = records[-20:][::-1]

        return jsonify({
            "success": True,
            "history": latest_records
        })

    except Exception as error:

        print("History Error:", error)

        return jsonify({
            "success": False,
            "error": "ไม่สามารถโหลดประวัติได้"
        }), 500


if __name__ == "__main__":

    app.run(debug=True)
