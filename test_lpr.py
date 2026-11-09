
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("AIFORTHAI_API_KEY")

url = "https://api.aiforthai.in.th/lpr-v2"

payload = {
    "crop": "1",
    "rotate": "1"
}

headers = {
    "Apikey": API_KEY
}

image_path = "test.jpg"

try:
    with open(image_path, "rb") as image:
        files = {
            "image": image
        }

        response = requests.post(
            url,
            files=files,
            data=payload,
            headers=headers,
            timeout=60
        )

    print("HTTP Status:", response.status_code)
    print("API Response:")

    print(response.text)

    if response.status_code == 200:
        result = response.json()

        print("\nอ่านป้ายทะเบียนสำเร็จ!")
        print(result)

    else:
        print("\nAPI เรียกใช้งานไม่สำเร็จ")

except Exception as error:
    print("Error:", error)
