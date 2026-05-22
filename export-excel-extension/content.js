// 1. Tạo nút Export dạng icon tròn, draggable
const btn = document.createElement("button");
btn.title = "Export Toàn Bộ Bảng";
const ICON_EXCEL = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_LOADING = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
btn.innerHTML = ICON_EXCEL;

Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "9999",
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    backgroundColor: "#1976d2",
    border: "none",
    cursor: "grab",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s, transform 0.1s",
    userSelect: "none",
});

btn.addEventListener("mouseenter", () => {
    if (!btn.disabled) btn.style.backgroundColor = "#1565c0";
});
btn.addEventListener("mouseleave", () => {
    if (!btn.disabled) btn.style.backgroundColor = "#1976d2";
});

document.body.appendChild(btn);

// --- DRAG LOGIC ---
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragMoved = false;

btn.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragMoved = false;
    dragOffsetX = e.clientX - btn.getBoundingClientRect().left;
    dragOffsetY = e.clientY - btn.getBoundingClientRect().top;
    btn.style.cursor = "grabbing";
    btn.style.transition = "none";
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    dragMoved = true;
    const y = e.clientY - dragOffsetY;
    const maxY = window.innerHeight - btn.offsetHeight;

    // Chỉ cho di chuyển dọc, cố định sát viền phải
    btn.style.top = Math.max(0, Math.min(y, maxY)) + "px";
    btn.style.right = "12px";
    btn.style.left = "auto";
    btn.style.bottom = "auto";
});

document.addEventListener("mouseup", () => {
    if (isDragging) {
        isDragging = false;
        btn.style.cursor = "grab";
        btn.style.transition = "background-color 0.2s, transform 0.1s";
    }
});

// Nếu drag thì không trigger click
btn.addEventListener("click", (e) => {
    if (dragMoved) { dragMoved = false; e.stopImmediatePropagation(); }
}, true);

// --- CÁC HÀM HỖ TRỢ ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Convert "rgb(r, g, b)" hoặc "rgba(r,g,b,a)" → "RRGGBB" cho xlsx
function rgbToHex(cssColor) {
    if (!cssColor || cssColor === "transparent" || cssColor === "rgba(0, 0, 0, 0)") return null;
    const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return [m[1], m[2], m[3]]
        .map(n => parseInt(n).toString(16).padStart(2, "0"))
        .join("").toUpperCase();
}

// Đọc computed style của 1 cell DOM → object style xlsx-js-style
function getCellStyle(el) {
    const cs = window.getComputedStyle(el);

    const bgHex = rgbToHex(cs.backgroundColor);
    const colorHex = rgbToHex(cs.color) || "000000";
    const bold = cs.fontWeight >= 600 || cs.fontWeight === "bold" || cs.fontWeight === "bolder";
    const italic = cs.fontStyle === "italic";
    const fontSize = Math.round(parseFloat(cs.fontSize) * 0.75); // px → pt

    const alignMap = { left: "left", center: "center", right: "right", justify: "justify" };
    const align = alignMap[cs.textAlign] || "left";

    // Border: lấy border-bottom làm đại diện (phổ biến nhất trong table)
    const hasBorder = parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderTopWidth) > 0;
    const borderColor = rgbToHex(cs.borderBottomColor) || "000000";
    const borderSide = { style: "thin", color: { rgb: borderColor } };

    const style = {
        font: { bold, italic, sz: fontSize, color: { rgb: colorHex } },
        alignment: { horizontal: align, vertical: "center", wrapText: false },
        border: hasBorder ? { top: borderSide, bottom: borderSide, left: borderSide, right: borderSide }
                          : { top: borderSide, bottom: borderSide, left: borderSide, right: borderSide },
    };
    if (bgHex) style.fill = { fgColor: { rgb: bgHex } };
    return style;
}

// Trích xuất data + style từ table DOM, trả về { data[][], styles[][] }
function extractTableWithStyles(table, skipHeader) {
    const data = [];
    const styles = [];
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
        if (skipHeader && row.querySelector("th")) return;
        const rowData = [];
        const rowStyles = [];
        row.querySelectorAll("th, td").forEach(cell => {
            rowData.push(cell.innerText.trim());
            rowStyles.push(getCellStyle(cell));
        });
        if (rowData.length > 0) {
            data.push(rowData);
            styles.push(rowStyles);
        }
    });
    return { data, styles };
}

// Tính column widths từ data
function autoColWidths(data) {
    if (!data || data.length === 0) return [];
    const numCols = Math.max(...data.map(r => r.length));
    const widths = Array(numCols).fill(10);
    data.forEach(row => {
        row.forEach((cell, i) => {
            const len = String(cell ?? "").length;
            if (len > widths[i]) widths[i] = len;
        });
    });
    return widths.map(w => ({ wch: Math.min(w + 2, 60) }));
}

// Tạo sheet từ data + styles đã extract
function buildSheet(data, styles) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = autoColWidths(data);
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            if (styles[R] && styles[R][C]) ws[addr].s = styles[R][C];
        }
    }
    return ws;
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
    btn.innerHTML = ICON_LOADING;
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
        let mainTableStyles = [];
        let extraTablesData = [];

        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            console.log(`Đang lấy dữ liệu trang ${currentPage}...`);

            let analysis = analyzeTables();
            if (analysis.tables.length === 0) {
                if (currentPage === 1) alert("Không tìm thấy bảng dữ liệu nào!");
                break;
            }

            if (currentPage === 1) {
                analysis.tables.forEach((table, index) => {
                    const isMain = (index === analysis.mainIndex);
                    const { data, styles } = extractTableWithStyles(table, false);
                    if (isMain) {
                        mainTableData = mainTableData.concat(data);
                        mainTableStyles = mainTableStyles.concat(styles);
                    } else {
                        extraTablesData.push({ sheetName: `Bang_Phu_${index + 1}`, data, styles });
                    }
                });
            } else {
                if (analysis.mainIndex !== -1) {
                    const { data, styles } = extractTableWithStyles(analysis.tables[analysis.mainIndex], true);
                    mainTableData = mainTableData.concat(data);
                    mainTableStyles = mainTableStyles.concat(styles);
                }
            }

            const nextBtn = findNextButton();
            if (nextBtn) { nextBtn.click(); currentPage++; await waitForPageChange(); }
            else { hasNextPage = false; }
        }

        // --- XUẤT TỪNG FILE EXCEL RIÊNG CHO MỖI BẢNG ---
        if (mainTableData.length > 0) {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, buildSheet(mainTableData, mainTableStyles), "Data");
            XLSX.writeFile(wb, "Bang_Chinh.xlsx");
        }

        extraTablesData.forEach((t, i) => {
            if (t.data.length > 0) {
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, buildSheet(t.data, t.styles), "Data");
                XLSX.writeFile(wb, `Bang_Phu_${i + 1}.xlsx`);
            }
        });

        console.log("Xuất Excel thành công!");

    } catch (error) {
        console.error("Lỗi trong quá trình quét:", error);
        alert("Có lỗi xảy ra, vui lòng xem Console!");
    } finally {
        btn.innerHTML = ICON_EXCEL;
        btn.style.backgroundColor = "#1976d2";
        btn.disabled = false;
    }
});
