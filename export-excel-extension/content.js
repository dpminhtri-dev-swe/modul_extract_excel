// 1. Tạo nút Export
const btn = document.createElement("button");
btn.innerText = "📥 Export Toàn Diện Toàn Bộ Bảng";
btn.style.position = "fixed";
btn.style.bottom = "20px";
btn.style.right = "20px";
btn.style.zIndex = "9999";
btn.style.padding = "10px 15px";
btn.style.backgroundColor = "#ff9800";
btn.style.color = "white";
btn.style.border = "none";
btn.style.borderRadius = "5px";
btn.style.cursor = "pointer";
btn.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
btn.style.fontWeight = "bold";

document.body.appendChild(btn);

// --- CÁC HÀM HỖ TRỢ ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractTableData(table, isFirstPage, isMainTable) {
    let data = [];
    let rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
        // Nếu là bảng chính và không phải trang 1 -> bỏ qua dòng chứa thẻ TH (tiêu đề) để khỏi lặp tiêu đề
        if (isMainTable && !isFirstPage && row.querySelector("th")) {
            return;
        }

        let rowData = [];
        let cells = row.querySelectorAll("th, td");
        cells.forEach(cell => {
            rowData.push(cell.innerText.trim());
        });
        if (rowData.length > 0) {
            data.push(rowData);
        }
    });
    return data;
}

// Tìm nút Next
function findNextButton() {
    const elements = document.querySelectorAll("button, a, .page-link");
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "»" || text === "Next" || text === ">" || text === "Tiếp") {
            if (el.disabled || el.classList.contains("disabled") || el.parentElement.classList.contains("disabled") || el.getAttribute("disabled") !== null) {
                return null;
            }
            return el;
        }
    }
    return null;
}

// Hàm tìm nút Trang 1 (kể cả khi đang active/disabled ở trang 1)
function findFirstPageButton() {
    // Ưu tiên tìm nút "First" / "«" / "Đầu" trước
    const elements = document.querySelectorAll("button, a, .page-link");
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "«" || text === "First" || text === "Đầu") {
            return el;
        }
    }
    // Fallback: tìm nút có text "1" trong pagination
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "1") {
            return el;
        }
    }
    return null;
}

// Kiểm tra trang hiện tại có phải trang 1 không
function isOnFirstPage() {
    // Cách 1: active page indicator
    const activeEl = document.querySelector(
        ".page-item.active .page-link, .page-link.active, .pagination .active a, li.active > a"
    );
    if (activeEl && activeEl.innerText.trim() === "1") return true;

    // Cách 2: nút Prev/« bị disabled
    const prevSelectors = ["button", "a", ".page-link"];
    for (let sel of prevSelectors) {
        for (let el of document.querySelectorAll(sel)) {
            let text = el.innerText.trim();
            if (text === "«" || text === "Prev" || text === "Previous" || text === "‹" || text === "Trước") {
                if (
                    el.disabled ||
                    el.classList.contains("disabled") ||
                    el.parentElement?.classList.contains("disabled") ||
                    el.getAttribute("aria-disabled") === "true"
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Chờ cho đến khi trang load xong (dùng MutationObserver thay vì sleep cứng)
function waitForPageChange(timeout = 5000) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) { settled = true; observer.disconnect(); resolve(); }
        }, timeout);

        // Theo dõi DOM thay đổi, sau khi DOM ổn định 400ms thì coi là load xong
        let debounce;
        const observer = new MutationObserver(() => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (!settled) { settled = true; clearTimeout(timer); observer.disconnect(); resolve(); }
            }, 400);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// Lấy ra tất cả các bảng hợp lệ và xác định đâu là bảng chính
function analyzeTables() {
    const allTablesNode = document.querySelectorAll("table");
    let validTables = [];
    let mainTableIndex = 0;
    let maxRows = 0;

    allTablesNode.forEach((table, index) => {
        let rowCount = table.querySelectorAll("tr").length;
        // Bỏ qua các bảng quá nhỏ (như bảng layout có 1 dòng)
        if (rowCount >= 2) {
            validTables.push(table);
            if (rowCount > maxRows) {
                maxRows = rowCount;
                mainTableIndex = validTables.length - 1;
            }
        }
    });

    return {
        tables: validTables,
        mainIndex: validTables.length > 0 ? mainTableIndex : -1
    };
}

// --- LOGIC XỬ LÝ CHÍNH KHI BẤM NÚT ---
btn.addEventListener("click", async () => {
    btn.innerText = "⏳ Đang quét dữ liệu toàn diện...";
    btn.style.backgroundColor = "#607d8b";
    btn.disabled = true;

    try {
        // Quay về trang 1 trước nếu chưa ở trang 1
        if (!isOnFirstPage()) {
            console.log("Đang quay về trang 1...");
            let firstPageBtn = findFirstPageButton();
            if (firstPageBtn) {
                firstPageBtn.click();
                await waitForPageChange();
            } else {
                // Không tìm được nút, fallback sleep
                await sleep(1500);
            }

            // Verify lại lần nữa
            if (!isOnFirstPage()) {
                console.warn("Không thể xác nhận đã về trang 1, tiếp tục từ trang hiện tại...");
            } else {
                console.log("Đã về trang 1 thành công.");
            }
        } else {
            console.log("Đang ở trang 1, bắt đầu export...");
        }

        let mainTableData = [];
        let extraTablesData = []; // Mảng chứa dữ liệu các bảng phụ

        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            console.log(`Đang lấy dữ liệu trang ${currentPage}...`);

            // Phân tích toàn bộ bảng trên màn hình
            let analysis = analyzeTables();
            if (analysis.tables.length === 0) {
                if (currentPage === 1) alert("Không tìm thấy bảng dữ liệu nào!");
                break;
            }

            // Ở TRANG ĐẦU TIÊN: Ta lấy dữ liệu của TẤT CẢ các bảng
            if (currentPage === 1) {
                analysis.tables.forEach((table, index) => {
                    let isMain = (index === analysis.mainIndex);
                    let data = extractTableData(table, true, isMain);

                    if (isMain) {
                        mainTableData = mainTableData.concat(data);
                    } else {
                        // Lưu các bảng phụ lại, chỉ lấy 1 lần ở trang đầu
                        extraTablesData.push({
                            sheetName: `Bang_Phu_${index + 1}`,
                            data: data
                        });
                    }
                });
            }
            // TỪ TRANG THỨ 2 TRỞ ĐI: Chỉ lặp và nối dữ liệu cho bảng Chính (để tránh nhân bản bảng phụ)
            else {
                if (analysis.mainIndex !== -1) {
                    let mainTable = analysis.tables[analysis.mainIndex];
                    let data = extractTableData(mainTable, false, true);
                    mainTableData = mainTableData.concat(data);
                }
            }

            let nextBtn = findNextButton();

            if (nextBtn) {
                nextBtn.click();
                currentPage++;
                await waitForPageChange();
            } else {
                hasNextPage = false;
            }
        }

        // --- XUẤT FILE EXCEL VỚI NHIỀU SHEET ---
        if (mainTableData.length > 0 || extraTablesData.length > 0) {
            const workbook = XLSX.utils.book_new();

            // 1. Ghi bảng chính (chứa dữ liệu của tất cả các trang) vào Sheet đầu tiên
            if (mainTableData.length > 0) {
                const mainSheet = XLSX.utils.aoa_to_sheet(mainTableData);
                XLSX.utils.book_append_sheet(workbook, mainSheet, "Data_Chinh");
            }

            // 2. Ghi các bảng phụ (nếu có) vào các Sheet tiếp theo
            extraTablesData.forEach((extraTable) => {
                if (extraTable.data.length > 0) {
                    const extraSheet = XLSX.utils.aoa_to_sheet(extraTable.data);
                    XLSX.utils.book_append_sheet(workbook, extraSheet, extraTable.sheetName);
                }
            });

            XLSX.writeFile(workbook, "DuLieu_ToanDien.xlsx");
            console.log("Xuất Excel thành công!");
        }

    } catch (error) {
        console.error("Lỗi trong quá trình quét:", error);
        alert("Có lỗi xảy ra, vui lòng xem Console!");
    } finally {
        btn.innerText = "📥 Export Toàn Diện Toàn Bộ Bảng";
        btn.style.backgroundColor = "#ff9800";
        btn.disabled = false;
    }
});
