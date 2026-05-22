// === CẤU HÌNH API NỘI BỘ ===
// Thay đổi URL này thành URL API lấy dữ liệu thực tế của cơ quan bạn
const INTERNAL_API_URL = "https://api.noibo.congty.com/v1/nhanvien/search";

// Các phần tử DOM
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const exportBtn = document.getElementById('exportBtn');
const tableBody = document.getElementById('tableBody');
const loadingDiv = document.getElementById('loading');
const noDataDiv = document.getElementById('noData');
const dataTable = document.getElementById('dataTable');

// Biến lưu trữ dữ liệu hiện tại để xuất Excel
let currentData = [];

// ==========================================
// HÀM MOCK DỮ LIỆU (Dùng để test khi chưa có API thật)
// ==========================================
async function mockFetchData(query) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockData = [
                { id: "NV01", name: "Nguyễn Văn A", department: "IT", role: "Developer", status: "Hoạt động" },
                { id: "NV02", name: "Trần Thị B", department: "HR", role: "Manager", status: "Hoạt động" },
                { id: "NV03", name: "Lê Văn C", department: "Sales", role: "Staff", status: "Nghỉ phép" },
                { id: "NV04", name: "Phạm Văn D", department: "IT", role: "Tester", status: "Hoạt động" }
            ];
            // Lọc dữ liệu theo từ khóa
            const filtered = mockData.filter(item => 
                item.name.toLowerCase().includes(query.toLowerCase()) || 
                item.id.toLowerCase().includes(query.toLowerCase())
            );
            resolve(filtered);
        }, 1000); // Giả lập độ trễ mạng 1 giây
    });
}

// ==========================================
// HÀM GỌI API THẬT (TỪ WEB NỘI BỘ)
// ==========================================
async function fetchInternalData(query) {
    try {
        // Cần điều chỉnh tham số (như ?keyword= hay body request) cho đúng với API thực tế của bạn
        const url = `${INTERNAL_API_URL}?keyword=${encodeURIComponent(query)}`;
        
        const response = await fetch(url, {
            method: 'GET', // Hoặc 'POST' tùy API của bạn
            headers: {
                'Content-Type': 'application/json',
                // Thêm Authorization token nếu API nội bộ yêu cầu đăng nhập
                // 'Authorization': 'Bearer YOUR_TOKEN_HERE',
                // 'Cookie': 'session_id=123456' // Nếu dùng cookie nội bộ
            }
        });

        if (!response.ok) {
            throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
        }

        const result = await response.json();
        
        // Điều chỉnh cho phù hợp với cấu trúc JSON trả về. (Ví dụ: result.data)
        return result.data || result; 
    } catch (error) {
        console.error("Lỗi khi gọi API nội bộ:", error);
        alert("Có lỗi xảy ra khi lấy dữ liệu từ mạng nội bộ. \nCó thể do lỗi mạng hoặc bị chặn bởi CORS policy. Vui lòng xem console (F12) để biết chi tiết.");
        return [];
    }
}

// ==========================================
// RENDER DỮ LIỆU RA BẢNG HTML
// ==========================================
function renderTable(data) {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        dataTable.classList.add('hidden');
        noDataDiv.classList.remove('hidden');
        noDataDiv.innerText = "Không tìm thấy dữ liệu phù hợp.";
        exportBtn.disabled = true;
        return;
    }

    dataTable.classList.remove('hidden');
    noDataDiv.classList.add('hidden');
    exportBtn.disabled = false;

    data.forEach(item => {
        const tr = document.createElement('tr');
        // Thay đổi các trường bên dưới cho ĐÚNG VỚI TÊN TRƯỜNG JSON mà API bạn trả về
        tr.innerHTML = `
            <td>${item.id || item.Id || item.ma_nv || ''}</td>
            <td>${item.name || item.Name || item.ten_nv || ''}</td>
            <td>${item.department || item.Department || item.phong_ban || ''}</td>
            <td>${item.role || item.Role || item.chuc_vu || ''}</td>
            <td>${item.status || item.Status || item.trang_thai || ''}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==========================================
// XỬ LÝ SỰ KIỆN TÌM KIẾM
// ==========================================
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) {
        alert("Vui lòng nhập từ khóa tìm kiếm!");
        return;
    }

    // Hiển thị trạng thái loading
    dataTable.classList.add('hidden');
    noDataDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
    exportBtn.disabled = true;

    // TODO: Thay thế mockFetchData thành fetchInternalData khi bạn muốn gọi API thật
    // LƯU Ý VỀ CORS: Khi gọi API từ web khác origin, bạn có thể gặp lỗi CORS.
    // currentData = await fetchInternalData(query);
    currentData = await mockFetchData(query);

    loadingDiv.classList.add('hidden');
    renderTable(currentData);
});

// Cho phép nhấn Enter trong ô input để tìm kiếm
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// ==========================================
// XUẤT FILE EXCEL VỚI SHEETJS
// ==========================================
exportBtn.addEventListener('click', () => {
    if (!currentData || currentData.length === 0) return;

    // Chuyển đổi dữ liệu JSON thành format chuẩn bị xuất Excel
    // Mục đích là để đổi tên các Cột (Header) thành Tiếng Việt thân thiện
    const exportData = currentData.map((item, index) => ({
        "STT": index + 1,
        "Mã Nhân Viên": item.id || item.Id || item.ma_nv,
        "Họ và Tên": item.name || item.Name || item.ten_nv,
        "Phòng Ban": item.department || item.Department || item.phong_ban,
        "Chức Vụ": item.role || item.Role || item.chuc_vu,
        "Trạng Thái": item.status || item.Status || item.trang_thai
    }));

    // Tạo một WorkSheet từ mảng JSON
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Cấu hình độ rộng cho các cột
    const colWidths = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã NV
        { wch: 25 }, // Tên
        { wch: 20 }, // Phòng
        { wch: 20 }, // Chức vụ
        { wch: 15 }  // Trạng thái
    ];
    worksheet['!cols'] = colWidths;

    // Tạo WorkBook mới và gán WorkSheet vào
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh_sach_ket_qua");

    // Lấy ngày giờ hiện tại để đặt tên file
    const now = new Date();
    const dateString = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours()}${now.getMinutes()}`;
    
    // Xuất file
    const fileName = `KetQuaTimKiem_${dateString}.xlsx`;
    XLSX.writeFile(workbook, fileName);
});
