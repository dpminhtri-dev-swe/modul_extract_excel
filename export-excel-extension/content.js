(() => {
// --- CSS NỘI BỘ CHO TOAST VÀ SPINNER ---
const styleTag = document.createElement("style");
styleTag.innerHTML = `
@keyframes spin-excel {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.excel-spinning {
    animation: spin-excel 1s linear infinite;
}
#export-excel-toast {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: all 0.3s ease-in-out;
    opacity: 0;
    transform: translateY(-20px);
    font-family: Arial, sans-serif;
    font-size: 14px;
    display: none;
}
`;
document.head.appendChild(styleTag);

// --- TOAST NOTIFICATION ---
function showToast(message, type = "info") {
    let toast = document.getElementById("export-excel-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "export-excel-toast";
        document.body.appendChild(toast);
    }
    
    if (type === "info") toast.style.backgroundColor = "#2196f3"; // Blue
    if (type === "success") toast.style.backgroundColor = "#4caf50"; // Green
    if (type === "error") toast.style.backgroundColor = "#f44336"; // Red
    if (type === "warning") toast.style.backgroundColor = "#ff9800"; // Orange

    toast.innerText = message;
    toast.style.display = "block";
    
    // Trigger reflow
    void toast.offsetWidth;
    
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    
    if (type !== "info") {
        setTimeout(hideToast, 4000);
    }
}

function hideToast() {
    let toast = document.getElementById("export-excel-toast");
    if (toast) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-20px)";
        setTimeout(() => {
            toast.style.display = "none";
        }, 300);
    }
}

// 1. Tạo nút Export dạng icon tròn, draggable
const btn = document.createElement("button");
btn.title = "Export Toàn Bộ Bảng";
const ICON_EXCEL = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_LOADING = `<svg class="excel-spinning" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
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

    // Xử lý nền: nếu transparent thì tìm nền của thẻ cha
    let bg = cs.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        let parent = el.parentElement;
        while (parent && parent !== document.documentElement) {
            let pBg = window.getComputedStyle(parent).backgroundColor;
            if (pBg !== 'rgba(0, 0, 0, 0)' && pBg !== 'transparent') {
                bg = pBg;
                break;
            }
            parent = parent.parentElement;
        }
    }

    const bgHex = rgbToHex(bg);
    const rawColorHex = rgbToHex(cs.color);

    // Nếu có background đậm thì giữ màu chữ gốc, không thì dùng đen
    const colorHex = rawColorHex || "000000";

    const bold = parseInt(cs.fontWeight) >= 600 || cs.fontWeight === "bold" || cs.fontWeight === "bolder" || el.tagName === "TH";
    const italic = cs.fontStyle === "italic";
    const fontSize = Math.round(parseFloat(cs.fontSize) * 0.75); // px → pt

    const alignMap = { left: "left", center: "center", right: "right", justify: "justify" };
    const align = alignMap[cs.textAlign] || (el.tagName === "TH" ? "center" : "left");

    const borderColor = rgbToHex(cs.borderBottomColor) || "CCCCCC";
    const borderSide = { style: "thin", color: { rgb: borderColor } };

    const style = {
        font: { bold, italic, sz: fontSize || 11, color: { rgb: colorHex } },
        alignment: { horizontal: align, vertical: "center", wrapText: false },
        border: { top: borderSide, bottom: borderSide, left: borderSide, right: borderSide },
    };

    // Chỉ set fill nếu có màu nền thực sự (không phải trắng/trong suốt)
    if (bgHex && bgHex !== "FFFFFF" && bgHex !== "000000") {
        style.fill = { patternType: "solid", fgColor: { rgb: bgHex } };
    } else if (bgHex === "FFFFFF") {
        style.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
    }

    return style;
}

// Trích xuất data + style từ table DOM, trả về { data[][], styles[][] }
function extractTableWithStyles(table, skipHeader) {
    const data = [];
    const styles = [];
    const rows = table.querySelectorAll("tr");
    let isFirstRow = true;

    rows.forEach((row) => {
        // Skip header row nếu có <th> và skipHeader = true
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
    // Tính lại STT nếu cột đầu là STT
    const isSTTColumn = data.length > 1 && 
        (/stt|số tt|no\.|#/i.test(data[0][0]) || 
         data.slice(1).every(r => !isNaN(parseInt(r[0]))));
    
    let finalData = data;
    let finalStyles = styles;
    
    if (isSTTColumn) {
        finalData = data.map((row, i) => i === 0 ? row : [String(i), ...row.slice(1)]);
        // Styles không đổi vì chỉ thay nội dung cell, không thay cấu trúc
    }

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    ws["!cols"] = autoColWidths(finalData);
    
    if (!ws["!ref"]) return ws;
    
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) ws[addr] = { v: "", t: "s" };
            if (finalStyles[R] && finalStyles[R][C]) {
                ws[addr].s = finalStyles[R][C];
            }
        }
    }
    return ws;
}

// Tìm nút Next
function findNextButton() {
    const elements = document.querySelectorAll("button, a, .page-link");
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "»" || text === "›" || text === "Next" || text === ">" || text === "Tiếp" || text.toLowerCase() === "next") {
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
    // Ưu tiên tìm nút "First" / "«" / "‹" / "Đầu" trước
    const elements = document.querySelectorAll("button, a, .page-link");
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "«" || text === "‹" || text === "First" || text === "Đầu" || text.toLowerCase() === "first") {
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

function getTableSignature() {
    const tables = document.querySelectorAll("table");
    return Array.from(tables).map(t => t.innerText).join("||");
}

// Chờ cho đến khi trang load xong (dùng polling thay vì MutationObserver để tối ưu tốc độ)
async function waitForPageChange(prevSignature, timeout = 3000) {
    return new Promise((resolve) => {
        let elapsed = 0;
        const interval = 100;
        
        const check = setInterval(() => {
            elapsed += interval;
            const currentSignature = getTableSignature();
            
            // Nếu text của bảng thay đổi, tức là trang đã render xong dữ liệu mới
            if (currentSignature !== prevSignature) {
                clearInterval(check);
                setTimeout(resolve, 50); 
                return;
            }
            
            if (elapsed >= timeout) {
                clearInterval(check);
                resolve();
            }
        }, interval);
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
        showToast("Đang chuẩn bị xuất dữ liệu...", "info");

        // Quay về trang 1 trước nếu chưa ở trang 1
        if (!isOnFirstPage()) {
            showToast("Đang quay về trang 1...", "info");
            let firstPageBtn = findFirstPageButton();
            if (firstPageBtn) {
                let sig = getTableSignature();
                firstPageBtn.click();
                await waitForPageChange(sig);
            } else {
                await sleep(1000);
            }
        }

        let mainTableData = [];
        let mainTableStyles = [];
        let extraTablesData = [];

        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            showToast(`Đang quét dữ liệu trang ${currentPage}...`, "info");
            console.log(`📄 Đang lấy dữ liệu trang ${currentPage}...`);

            let analysis = analyzeTables();
            if (analysis.tables.length === 0) {
                if (currentPage === 1) showToast("Không tìm thấy bảng dữ liệu nào!", "warning");
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
            
            if (nextBtn) {
                let sig = getTableSignature();
                nextBtn.click();
                currentPage++;
                await waitForPageChange(sig);
            } else {
                hasNextPage = false;
            }
        }

        if (mainTableData.length > 0) {
            showToast("Đang tạo file Excel...", "info");
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

        showToast(`Xuất Excel thành công ${mainTableData.length} dòng!`, "success");

    } catch (error) {
        console.error("Lỗi trong quá trình quét:", error);
        showToast("Có lỗi xảy ra trong quá trình xuất! Xem Console.", "error");
    } finally {
        btn.innerHTML = ICON_EXCEL;
        btn.style.backgroundColor = "#1976d2";
        btn.disabled = false;
        if (document.getElementById("export-excel-toast")?.style.backgroundColor === "rgb(33, 150, 243)") {
            hideToast();
        }
    }
});

})();