# Nút Export Excel Nội Bộ (Export Excel Extension)

Đây là một Chrome Extension (Tiện ích mở rộng trên Chrome) giúp thêm một nút nổi vào các trang web nội bộ (cụ thể là `*://dichvucongcbt.gdt.gov.vn/*` hoặc các file HTML nội bộ) để hỗ trợ việc trích xuất (export) dữ liệu từ các bảng HTML ra file Excel (.xlsx).

## Các tính năng nổi bật (Features)

Công cụ này hỗ trợ các tính năng mạnh mẽ sau đây:

### 1. Nút Export nổi và có thể di chuyển (Draggable Floating Button)
- Hiển thị một nút icon Excel nổi ở góc phải bên dưới màn hình.
- Người dùng có thể **kéo thả (drag) nút này theo chiều dọc** để tránh che khuất các phần tử khác trên trang web. Nút sẽ luôn bám theo lề phải của màn hình.
- Nút có hiệu ứng hover và hiệu ứng xoay (spinner) khi đang xử lý xuất dữ liệu.

### 2. Tự động thu thập dữ liệu qua nhiều trang (Auto Pagination Crawling)
- Tool có khả năng tự động gom dữ liệu từ tất cả các trang của một bảng.
- Khi người dùng bấm xuất, tool sẽ tự động tìm và click nút quay về **Trang 1** (First page).
- Sau đó, tool quét dữ liệu trang hiện tại, rồi tự động tìm và click nút **Trang tiếp theo** (Next page), lặp lại quá trình này cho đến trang cuối cùng.

### 3. Giữ nguyên định dạng bảng (Style Preservation)
Không chỉ lấy dữ liệu thô, tool còn trích xuất cả CSS của HTML và áp dụng vào file Excel, bao gồm:
- **Màu sắc:** Giữ nguyên màu nền (Background color) và màu chữ (Text color), tự động chuyển đổi từ RGB/RGBA sang HEX cho Excel.
- **Phông chữ:** Giữ nguyên độ đậm (Bold), in nghiêng (Italic) và kích thước chữ (Font size).
- **Căn lề:** Hỗ trợ căn trái, phải, giữa và căn đều (left, right, center, justify).
- **Viền (Border):** Giữ lại các đường viền của bảng.

### 4. Xử lý nhiều bảng trên cùng một trang (Multi-table Handling)
- Tool tự động phân tích và tìm tất cả các bảng hợp lệ (có từ 2 dòng trở lên) trên trang web.
- **Bảng chính:** Bảng có số lượng dòng nhiều nhất sẽ được coi là "bảng chính". Dữ liệu của bảng này qua các trang sẽ được nối (append) lại với nhau và xuất ra file `Bang_Chinh.xlsx`.
- **Bảng phụ:** Các bảng nhỏ khác trên trang 1 sẽ được xuất riêng lẻ thành các file `Bang_Phu_1.xlsx`, `Bang_Phu_2.xlsx`, v.v.

### 5. Căn chỉnh tự động thông minh (Smart Auto-adjustments)
- **Tự động tính lại số thứ tự (STT):** Nếu phát hiện cột đầu tiên là cột Số thứ tự, khi nối dữ liệu từ nhiều trang, tool sẽ tự động đánh lại số thứ tự liên tục từ 1 cho đến hết thay vì lặp lại STT của từng trang.
- **Tự động căn chỉnh độ rộng cột:** Tính toán độ dài của văn bản dài nhất trong mỗi cột để thiết lập độ rộng cột (Column Width) trong Excel cho phù hợp (tối đa 60 ký tự), giúp nội dung không bị che khuất.

### 6. Thông báo trực quan (Toast Notifications)
- Hiển thị các thông báo (Toast popup) ở góc trên bên phải màn hình để báo cáo trạng thái cho người dùng trong suốt quá trình:
  - *"Đang chuẩn bị xuất dữ liệu..."*
  - *"Đang quay về trang 1..."*
  - *"Đang quét dữ liệu trang X..."*
  - *"Đang tạo file Excel..."*
  - *"Xuất Excel thành công X dòng!"* (Kèm màu xanh lá) hoặc thông báo lỗi (Màu đỏ).

## Cài đặt (Installation)
1. Mở trình duyệt Chrome / Edge, truy cập vào `chrome://extensions/`
2. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển).
3. Bấm **Load unpacked** (Tải tiện ích đã giải nén).
4. Chọn thư mục `export-excel-extension` chứa source code này.

## Thư viện sử dụng
- [SheetJS (xlsx)](https://sheetjs.com/): Dùng để khởi tạo, tùy chỉnh định dạng (style) và ghi file Excel (`xlsx-js-style.min.js`).
