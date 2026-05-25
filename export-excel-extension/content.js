(() => {
// --- AUTODOWNLOAD PROXY BẰNG HÀM GỐC ---
// Lấy URL thực sự ban đầu được mở (tránh bị Router SPA xóa param)
const navEntries = performance.getEntriesByType("navigation");
const initialUrl = navEntries.length > 0 ? navEntries[0].name : window.location.href;

if (initialUrl.includes("ext-auto-download=1")) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,255,255,0.95); z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:Arial, sans-serif;";
    overlay.innerHTML = `
        <h2 id="auto-download-title" style="color:#1976d2; margin-bottom: 10px;">Đang tiến hành tải file...</h2>
        <p style="color:#333; font-size:16px;">Vui lòng không đóng trang này, hệ thống đang xử lý tải về.</p>
        <p id="auto-download-subtext" style="color:#888; font-size:14px; margin-top:20px;">(Trạng thái: Đang lấy dữ liệu an toàn...)</p>
        <button id="auto-download-close-btn" style="margin-top: 20px; padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; display: none; font-size: 14px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">Đóng trang ngay</button>
    `;
    
    // Đợi DOM sẵn sàng mới append overlay
    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    }
    
    // Đọc params
    const params = new URL(initialUrl).searchParams;
    const datasetObj = {};
    params.forEach((value, key) => {
        if (key !== "ext-auto-download") {
            datasetObj[key] = value;
        }
    });
    
    // Dùng thủ thuật gắn sự kiện onclick để chạy code trong Page Context mà KHÔNG dùng thẻ <script>.
    // Thủ thuật này giúp vượt qua hoàn toàn cơ chế bảo mật CSP (Content Security Policy) khắt khe của hệ thống thuế.
    let attempts = 0;
    const tryDownload = setInterval(() => {
        attempts++;
        
        // 1. Kiểm tra xem hàm downloadFile đã sẵn sàng chưa bằng cách ghi kết quả vào DOM
        const checker = document.createElement("div");
        checker.setAttribute("onclick", "document.documentElement.setAttribute('data-df-ready', typeof downloadFile === 'function' ? 'yes' : 'no')");
        document.body.appendChild(checker);
        checker.click();
        checker.remove();
        
        const readyStatus = document.documentElement.getAttribute("data-df-ready");
        
        if (readyStatus === "yes") {
            clearInterval(tryDownload);
            
            // 2. Kích hoạt click giả lập để gọi hàm tải file gốc của hệ thống!
            const a = document.createElement("a");
            a.setAttribute("onclick", "try { downloadFile(this.dataset); document.documentElement.setAttribute('data-df-status', 'ok'); } catch(e) { document.documentElement.setAttribute('data-df-status', 'error: ' + e.message); }");
            a.dataset.mahso = datasetObj.mahso || datasetObj.maHso;
            a.dataset.type = datasetObj.type || datasetObj.loaiTai;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            const execStatus = document.documentElement.getAttribute("data-df-status");
            
            if (execStatus === "ok") {
                const title = document.getElementById("auto-download-title");
                if (title) title.innerText = "Đã gửi lệnh tải file thành công!";
                const subtext = document.getElementById("auto-download-subtext");
                if (subtext) subtext.innerText = "Hệ thống đang nén và tải xuống. Nếu thấy file đã tải xong, bạn có thể tự đóng trang.";
                
                const closeBtn = document.getElementById("auto-download-close-btn");
                if (closeBtn) {
                    closeBtn.style.display = "block";
                    closeBtn.onclick = () => window.close();
                }
                
                // Vẫn giữ timeout 15 giây dự phòng đóng tab tự động
                setTimeout(() => { window.close(); }, 15000);
            } else {
                const title = document.getElementById("auto-download-title");
                if (title) {
                    title.innerText = "Lỗi khi chạy tải file: " + execStatus;
                    title.style.color = "red";
                }
            }
        } else if (readyStatus === "no") {
            if (attempts > 30) { // Đã chờ 15 giây nhưng web chưa load xong JS
                clearInterval(tryDownload);
                const title = document.getElementById("auto-download-title");
                if (title) {
                    title.innerText = "Lỗi: Không tìm thấy hàm gốc của hệ thống!";
                    title.style.color = "red";
                }
                const subtext = document.getElementById("auto-download-subtext");
                if (subtext) subtext.innerText = "Web tải quá chậm hoặc cấu trúc web đã thay đổi.";
            }
        } else {
            // readyStatus là null -> CSP của trình duyệt chặn cả unsafe-inline! 
            // Rơi vào đường cùng, ta fallback sang cơ chế fetch vét cạn mọi thông tin Token.
            if (attempts > 3) {
                clearInterval(tryDownload);
                
                function getCookie(name) {
                    const value = "; " + document.cookie;
                    const parts = value.split("; " + name + "=");
                    if (parts.length === 2) return parts.pop().split(";").shift();
                    return "";
                }
                
                const metaCsrf = document.querySelector('meta[name="_csrf"]');
                let xsrfToken = metaCsrf ? metaCsrf.content : "";
                if (!xsrfToken) xsrfToken = getCookie("XSRF-TOKEN") || getCookie("X-XSRF-TOKEN") || localStorage.getItem("XSRF-TOKEN") || sessionStorage.getItem("XSRF-TOKEN") || "";
                
                const fetchPayload = { maHso: datasetObj.mahso || datasetObj.maHso, loaiTai: datasetObj.type || datasetObj.loaiTai };
                
                fetch(window.location.origin + "/cbt-web/traCuuTTHC/downloadFile", {
                    method: "POST",
                    headers: { "accept": "*/*", "content-type": "application/json", "x-xsrf-token": xsrfToken },
                    body: JSON.stringify(fetchPayload), credentials: "include"
                }).then(async (res) => {
                    if (!res.ok) throw new Error("Mã lỗi Server: " + res.status);
                    const disposition = res.headers.get("content-disposition");
                    let filename = "Tai_Lieu_" + fetchPayload.maHso + ".zip";
                    if (disposition && disposition.indexOf('attachment') !== -1) {
                        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                        if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const da = document.createElement('a'); da.href = url; da.download = filename;
                    document.body.appendChild(da); da.click(); da.remove();
                    const titleEl = document.getElementById("auto-download-title");
                    if (titleEl) titleEl.innerText = "Tải file hoàn tất (Bằng phương pháp dự phòng)!";
                    const subtextEl = document.getElementById("auto-download-subtext");
                    if (subtextEl) subtextEl.innerText = "Trang sẽ tự động đóng ngay lập tức...";
                    setTimeout(() => { window.URL.revokeObjectURL(url); window.close(); }, 1500);
                }).catch(e => {
                    const titleEl = document.getElementById("auto-download-title");
                    if (titleEl) { titleEl.innerText = "Lỗi bảo mật (CSP) chặn tải file: " + e.message; titleEl.style.color = "red"; }
                });
            }
        }
    }, 500);
    
    return;
}

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
    const hasTh = table.querySelector("th") !== null;
    let validRowCount = 0;

    rows.forEach((row) => {
        const cells = row.querySelectorAll("th, td");
        if (cells.length === 0) return;

        let isHeaderRow = false;
        if (hasTh) {
            isHeaderRow = row.querySelector("th") !== null;
        } else {
            isHeaderRow = (validRowCount === 0);
        }

        validRowCount++;

        // Skip header row nếu skipHeader = true
        if (skipHeader && isHeaderRow) return;
        
        const rowData = [];
        const rowStyles = [];
        cells.forEach(cell => {
            let cellText = cell.innerText.trim();
            let hyperlinkUrl = null;
            const link = cell.querySelector("a[href]");
            
            if (link) {
                const href = link.getAttribute("href");
                if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
                    hyperlinkUrl = link.href; // Absolute URL
                } else if (link.dataset && Object.keys(link.dataset).length > 0) {
                    // Xử lý các thẻ a dùng JavaScript tải file có mang data-* attributes
                    try {
                        let onclickStr = link.getAttribute("onclick") || "";
                        if (onclickStr.includes("download") || (link.dataset.mahso && link.dataset.type)) {
                            // Trỏ thẳng vào trang tra cứu hiện tại (trang hợp lệ).
                            // Dùng ext-auto-download=1 để kích hoạt Auto-Download Proxy.
                            const url = new URL(window.location.href);
                            url.search = ""; // Xóa query cũ
                            url.hash = ""; // Xóa hash cũ
                            url.searchParams.set("ext-auto-download", "1");
                            for (let key in link.dataset) {
                                url.searchParams.set(key, link.dataset[key]);
                            }
                            hyperlinkUrl = url.href;
                        }
                    } catch (e) {
                        console.error("Lỗi tạo URL tải file:", e);
                    }
                }
                
                if (hyperlinkUrl && !cellText) {
                    cellText = link.innerText.trim() || "Tải xuống/Xem";
                }
            }

            rowData.push(cellText);
            let style = getCellStyle(cell);
            
            // Ép kiểu header nếu dòng đầu tiên dùng thẻ <td>
            if (isHeaderRow && !hasTh) {
                style.font.bold = true;
                style.alignment.horizontal = "center";
            }
            
            // Định dạng Hyperlink
            if (hyperlinkUrl) {
                style.font.color = { rgb: "0000FF" };
                style.font.underline = true;
                style._hyperlink = hyperlinkUrl;
            }

            rowStyles.push(style);
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
                if (finalStyles[R][C]._hyperlink) {
                    ws[addr].l = { Target: finalStyles[R][C]._hyperlink };
                }
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