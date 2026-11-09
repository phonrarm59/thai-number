
// ======================================
// 1. เรียกใช้งาน HTML Elements
// ======================================

const imageInput = document.getElementById("imageInput");
const chooseBtn = document.getElementById("chooseBtn");
const analyzeBtn = document.getElementById("analyzeBtn");

const previewImage = document.getElementById("previewImage");
const resultImage = document.getElementById("resultImage");

const plateNumber = document.getElementById("plateNumber");
const statusBox = document.getElementById("statusBox");
const actionArea = document.getElementById("actionArea");

const resultSection = document.getElementById("resultSection");

const addVehicleBtn = document.getElementById("addVehicleBtn");
const actionMessage = document.getElementById("actionMessage");


// ======================================
// 2. ตัวแปรเก็บข้อมูล
// ======================================

let selectedFile = null;


// ======================================
// 3. เลือกรูปภาพ
// ======================================

chooseBtn.addEventListener("click", () => {
    imageInput.click();
});


// ======================================
// 4. แสดงตัวอย่างรูปภาพ
// ======================================

imageInput.addEventListener("change", () => {

    const file = imageInput.files[0];

    if (!file) return;

    selectedFile = file;

    const reader = new FileReader();

    reader.onload = function (event) {

        previewImage.src = event.target.result;

        previewImage.classList.remove("hidden");

    };

    reader.readAsDataURL(file);

    analyzeBtn.disabled = false;

    // ซ่อนผลลัพธ์เดิมเมื่อเลือกรูปใหม่
    resultSection.classList.add("hidden");

    addVehicleBtn.classList.add("hidden");

});


// ======================================
// 5. ส่งรูปภาพไปยัง AI FOR THAI
// ======================================

analyzeBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("กรุณาเลือกรูปภาพก่อน");

        return;
    }

    analyzeBtn.disabled = true;

    analyzeBtn.textContent = "กำลังตรวจสอบ...";

    resultSection.classList.remove("hidden");

    resultImage.src = previewImage.src;

    plateNumber.textContent = "กำลังอ่านป้ายทะเบียน...";

    statusBox.textContent = "กำลังเชื่อมต่อ AI FOR THAI";

    statusBox.classList.remove("success", "error");

    addVehicleBtn.classList.add("hidden");

    actionMessage.textContent = "";

    const formData = new FormData();

    formData.append("image", selectedFile);

    try {

        const response = await fetch("/recognize", {

            method: "POST",

            body: formData

        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(data.error || "เกิดข้อผิดพลาด");

        }

        // แสดงเลขทะเบียน
        plateNumber.textContent = data.plate;


        // ======================================
        // 6. ตรวจสอบทะเบียนใน Google Sheets
        // ======================================

        
if (data.registered) {

    statusBox.textContent = "พบทะเบียนในฐานข้อมูลแล้ว";

    actionMessage.textContent =
        `จังหวัด: ${data.vehicle.Province} | ประเภทรถ: ${data.vehicle.Vehicle_Type} | เจ้าของ: ${data.vehicle.Owner_Name}`;

    autoOpenGate();
    

    addVehicleBtn.classList.add("hidden");

} else {

    statusBox.textContent = "ไม่พบทะเบียนในฐานข้อมูล";

    gateMessage.textContent = "";

    addVehicleBtn.classList.remove("hidden");

    // แสดงปุ่มเปิดประตู
    openGateBtn.classList.remove("hidden");

    // รีเซ็ตปุ่ม
    openGateBtn.disabled = false;
    openGateBtn.textContent = "↑ OPEN GATE";
}
await loadHistory();


    } catch (error) {

        plateNumber.textContent = "ไม่สามารถอ่านทะเบียนได้";

        statusBox.textContent = error.message;

        statusBox.classList.add("error");

        addVehicleBtn.classList.add("hidden");

    } finally {

        analyzeBtn.disabled = false;

        analyzeBtn.textContent = "ตรวจสอบทะเบียน";

    }

});


// ======================================
// 7. ปุ่มเพิ่มทะเบียน
// ======================================

addVehicleBtn.addEventListener("click", () => {

    alert("เตรียมเข้าสู่ขั้นตอนเพิ่มทะเบียนรถ");

});
window.addEventListener("load", () => {
    const btn = document.getElementById("addVehicleBtn");

    console.log("พบปุ่ม:", btn);

    btn.classList.remove("hidden");
});

// เรียกใช้งาน Popup
const addVehicleModal = document.getElementById("addVehicleModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const newPlate = document.getElementById("newPlate");
const addVehicleForm = document.getElementById("addVehicleForm");

// กดปุ่มเพิ่มทะเบียน
addVehicleBtn.addEventListener("click", () => {

    // นำเลขทะเบียนจากผล AI มาใส่ในฟอร์ม
    newPlate.value = plateNumber.textContent.trim();

    // แสดง Popup
    addVehicleModal.classList.remove("hidden");

});

// กดปุ่มปิด
closeModalBtn.addEventListener("click", () => {
    addVehicleModal.classList.add("hidden");
});

// คลิกพื้นที่ด้านนอกเพื่อปิด Popup
addVehicleModal.addEventListener("click", (event) => {

    if (event.target === addVehicleModal) {
        addVehicleModal.classList.add("hidden");
    }

});

// ทดสอบการส่งฟอร์ม
addVehicleForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const saveBtn = addVehicleForm.querySelector(".save-btn");

    // รวบรวมข้อมูลจากฟอร์ม
    const vehicleData = {
        plate: newPlate.value.trim(),
        province: document.getElementById("newProvince").value.trim(),
        vehicle_type: document.getElementById("newVehicleType").value,
        owner: document.getElementById("newOwner").value.trim()
    };

    // ป้องกันการกดบันทึกซ้ำ
    saveBtn.disabled = true;
    saveBtn.textContent = "กำลังบันทึก...";

    try {

        const response = await fetch("/add_vehicle", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(vehicleData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "เกิดข้อผิดพลาด");
        }

        // แจ้งผลสำเร็จ
        alert("บันทึกทะเบียนเรียบร้อยแล้ว!");

        // ปิด Popup
        addVehicleModal.classList.add("hidden");

        // อัปเดตสถานะบนหน้าผลตรวจจับ
        statusBox.textContent = "ลงทะเบียนรถเรียบร้อยแล้ว";
        statusBox.classList.remove("error");
        statusBox.classList.add("success");

        actionMessage.textContent =
            "จังหวัด: " + vehicleData.province +
            " | ประเภทรถ: " + vehicleData.vehicle_type +
            " | เจ้าของ: " + vehicleData.owner;

        addVehicleBtn.classList.add("hidden");

        // ล้างฟอร์ม
        addVehicleForm.reset();

    } catch (error) {

        alert(error.message);

    } finally {

        saveBtn.disabled = false;
        saveBtn.textContent = "บันทึกทะเบียน";

    }

});
// โหลดประวัติการตรวจจับ

async function loadHistory() {

    const tableBody = document.getElementById("historyTableBody");

    // ตรวจสอบว่ามีตารางประวัติหรือไม่
    if (!tableBody) {
        console.error("ไม่พบ historyTableBody ใน HTML");
        return;
    }

    try {
        const response = await fetch("/history");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "โหลดประวัติไม่สำเร็จ");
        }

        tableBody.innerHTML = "";

        if (!data.history || data.history.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5">ยังไม่มีประวัติการตรวจจับ</td>
                </tr>
            `;
            return;
        }

        data.history.forEach(record => {

            const row = document.createElement("tr");

            const values = [
                record.License_Plate,
                record.Province,
                record.Detection_Date,
                record.Detection_Time
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value || "-";
                row.appendChild(cell);
            });

            const statusCell = document.createElement("td");
            const status = document.createElement("span");

            status.textContent = record.Status || "-";
            status.classList.add("history-status");

            if (record.Status === "Registered") {
                status.classList.add("registered");
            } else {
                status.classList.add("not-registered");
            }

            statusCell.appendChild(status);
            row.appendChild(statusCell);

            tableBody.appendChild(row);
        });

    } catch (error) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">ไม่สามารถโหลดประวัติได้</td>
            </tr>
        `;

        console.error("History Error:", error);
    }
}


// ปุ่มรีเฟรชประวัติ
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener("click", loadHistory);
}


// โหลดประวัติเมื่อเปิดเว็บไซต์
loadHistory();
function autoOpenGate() {

    const openGateBtn = document.getElementById("openGateBtn");
    const gateMessage = document.getElementById("gateMessage");

    if (openGateBtn) {
        openGateBtn.classList.add("hidden");
    }

    gateMessage.textContent = "กำลังเปิดไม้กั้น...";

    setTimeout(() => {
        gateMessage.textContent = "✓ เปิดไม้กั้นสำเร็จ!";
    }, 1000);
}
const openGateBtn = document.getElementById("openGateBtn");
const closeGateBtn = document.getElementById("closeGateBtn");
const gateMessage = document.getElementById("gateMessage");

// จำลองเปิดไม้กั้น
function openGate() {

    gateMessage.textContent = "กำลังเปิดไม้กั้น...";

    openGateBtn.disabled = true;
    closeGateBtn.disabled = true;

    setTimeout(() => {
        gateMessage.textContent = "✓ เปิดไม้กั้นสำเร็จ!";
        openGateBtn.disabled = false;
        closeGateBtn.disabled = false;
    }, 1000);
}

// จำลองปิดไม้กั้น
function closeGate() {

    gateMessage.textContent = "กำลังปิดไม้กั้น...";

    openGateBtn.disabled = true;
    closeGateBtn.disabled = true;

    setTimeout(() => {
        gateMessage.textContent = "✓ ปิดไม้กั้นสำเร็จ!";
        openGateBtn.disabled = false;
        closeGateBtn.disabled = false;
    }, 1000);
}

// กดปุ่มเปิด
openGateBtn.addEventListener("click", openGate);

// กดปุ่มปิด
closeGateBtn.addEventListener("click", closeGate);
function autoOpenGate() {
    openGate();
}