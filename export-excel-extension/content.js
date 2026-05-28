(() => {
const AUTO_DOWNLOAD_ACTION = "download-file";
const SAFE_DOWNLOAD_CALL = "downloadFile(this.dataset)";

function isAllowedDownloadCode(code) {
    return /^\s*downloadFile\s*\(\s*this\.dataset\s*\)\s*;?\s*(?:return\s+false\s*;?\s*)?$/i.test(code || "");
}

function copySafeDataset(source) {
    const safe = {};
    for (let key in source) {
        if (!/^[a-zA-Z0-9_]{1,64}$/.test(key)) continue;
        safe[key] = String(source[key]).slice(0, 2048);
    }
    return safe;
}

function buildSafeDownloadOnclick(includeStatus) {
    const successStatus = includeStatus ? "document.documentElement.setAttribute('data-df-status', 'ok');" : "";
    const errorStatus = includeStatus ? `
                if (e instanceof ReferenceError) {
                    document.documentElement.setAttribute('data-df-status', 'wait');
                } else {
                    document.documentElement.setAttribute('data-df-status', 'error: ' + e.message);
                }` : "console.error('Bulk DL Error:', e);";

    return `
            try {
                ${SAFE_DOWNLOAD_CALL};
                ${successStatus}
            } catch(e) {${errorStatus}
            }
        `;
}
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
    let onclickStr = "";
    let requestedAction = params.get("ext-action") || "";
    
    params.forEach((value, key) => {
        if (key === "ext-onclick-b64") {
            try {
                onclickStr = decodeURIComponent(atob(value));
            } catch(e) {
                console.error("Lỗi giải mã base64:", e);
            }
        } else if (key === "ext-onclick") {
            // Fallback cho link phiên bản cũ
            onclickStr = decodeURIComponent(value);
        } else if (key.startsWith("data-")) {
            datasetObj[key.substring(5)] = value;
        }
    });
    
    if (requestedAction !== AUTO_DOWNLOAD_ACTION) {
        if (!onclickStr || isAllowedDownloadCode(onclickStr)) {
            requestedAction = AUTO_DOWNLOAD_ACTION;
        }
    }

    if (requestedAction !== AUTO_DOWNLOAD_ACTION) {
        const title = document.getElementById("auto-download-title");
        if (title) {
            title.innerText = "Link tai khong hop le";
            title.style.color = "red";
        }
        const subtext = document.getElementById("auto-download-subtext");
        if (subtext) subtext.innerText = "Extension chi cho phep hanh dong tai file da duoc whitelist.";
        return;
    }
    
    // Dùng thủ thuật gắn sự kiện onclick để chạy code trong Page Context mà KHÔNG dùng thẻ <script>.
    // Cực kỳ linh hoạt: tự động chạy BẤT KỲ đoạn mã JavaScript nào được copy từ web gốc!
    let attempts = 0;
    const tryDownload = setInterval(() => {
        attempts++;
        
        const a = document.createElement("a");
        // Đưa đoạn mã của trang gốc vào trong try...catch.
        // Nếu hàm chưa load xong (ReferenceError), nó sẽ báo 'wait' để chờ tiếp.
        a.setAttribute("onclick", buildSafeDownloadOnclick(true));
        
        const safeDatasetObj = copySafeDataset(datasetObj);
        for (let key in safeDatasetObj) {
            a.dataset[key] = safeDatasetObj[key];
        }
        
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        const execStatus = document.documentElement.getAttribute("data-df-status");
        
        if (execStatus === "ok") {
            clearInterval(tryDownload);
            
            const title = document.getElementById("auto-download-title");
            if (title) title.innerText = "Đã gửi lệnh tải file thành công!";
            const subtext = document.getElementById("auto-download-subtext");
            if (subtext) subtext.innerText = "Hệ thống đang nén và tải xuống. Nếu thấy file đã tải xong, bạn có thể tự đóng trang.";
            
            const closeBtn = document.getElementById("auto-download-close-btn");
            if (closeBtn) {
                closeBtn.style.display = "block";
                closeBtn.onclick = () => window.close();
            }
            
            setTimeout(() => { window.close(); }, 15000);
        } else if (execStatus === "wait") {
            if (attempts > 30) { 
                clearInterval(tryDownload);
                const title = document.getElementById("auto-download-title");
                if (title) {
                    title.innerText = "Lỗi: Không tìm thấy hàm gốc của hệ thống!";
                    title.style.color = "red";
                }
                const subtext = document.getElementById("auto-download-subtext");
                if (subtext) subtext.innerText = "Web tải quá chậm hoặc hệ thống không hỗ trợ mã: " + onclickStr;
            }
        } else {
            clearInterval(tryDownload);
            const title = document.getElementById("auto-download-title");
            if (title) {
                title.innerText = "Lỗi khi chạy mã web gốc: " + execStatus;
                title.style.color = "red";
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
// --- FAB CONTAINER (CHỨA CÁC NÚT CHỨC NĂNG) ---
const fabContainer = document.createElement("div");
Object.assign(fabContainer.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "9999",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    cursor: "grab",
    userSelect: "none",
});

// 1. Nút Export Excel
const btn = document.createElement("button");
btn.title = "Export Toàn Bộ Bảng Ra Excel";
const ICON_EXCEL = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_LOADING = `<svg class="excel-spinning" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
btn.innerHTML = ICON_EXCEL;

Object.assign(btn.style, {
    width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "#1976d2",
    border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background-color 0.2s"
});
btn.addEventListener("mouseenter", () => { if (!btn.disabled) btn.style.backgroundColor = "#1565c0"; });
btn.addEventListener("mouseleave", () => { if (!btn.disabled) btn.style.backgroundColor = "#1976d2"; });

// 2. Nút Tải Hàng Loạt
const bulkBtn = document.createElement("button");
bulkBtn.title = "Tải Xuống Toàn Bộ File Ngay Trên Web";
const ICON_BULK = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 6l5 5 5-5" opacity="0.3"/><line x1="12" y1="11" x2="12" y2="-1" opacity="0.3"/></svg>`;
bulkBtn.innerHTML = ICON_BULK;

Object.assign(bulkBtn.style, {
    width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "#4caf50", // Màu xanh lá
    border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background-color 0.2s"
});
bulkBtn.addEventListener("mouseenter", () => { if (!bulkBtn.disabled) bulkBtn.style.backgroundColor = "#388e3c"; });
bulkBtn.addEventListener("mouseleave", () => { if (!bulkBtn.disabled) bulkBtn.style.backgroundColor = "#4caf50"; });

fabContainer.appendChild(bulkBtn);
fabContainer.appendChild(btn);
document.body.appendChild(fabContainer);

// --- THEO DÕI URL TRONG SPA (KHÔNG DÙNG SETINTERVAL) ---
// Thay vì đếm ngược mỗi 50ms, ta dùng MutationObserver để bắt chính xác khoảnh khắc trang web thay đổi DOM (chuyển trang)
let lastUrl = location.href;
const toggleBulkBtnVisibility = () => {
    const isTargetPage = window.location.href.includes("traCuuTTHC/seacrchTTHC");
    if (isTargetPage && bulkBtn.style.display !== "flex") {
        bulkBtn.style.display = "flex";
    } else if (!isTargetPage && bulkBtn.style.display !== "none") {
        bulkBtn.style.display = "none";
    }
};

// Gọi lần đầu khi load
toggleBulkBtnVisibility();

// Theo dõi mọi sự thay đổi trên giao diện để cập nhật nút tức thì
const checkUrlChange = () => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        toggleBulkBtnVisibility();
    }
};

["pushState", "replaceState"].forEach(method => {
    const original = history[method];
    history[method] = function(...args) {
        const result = original.apply(this, args);
        queueMicrotask(checkUrlChange);
        return result;
    };
});
window.addEventListener("popstate", checkUrlChange);

// --- MODAL XÁC NHẬN ---
function showConfirmModal(count) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: "100000",
            display: "flex", justifyContent: "center", alignItems: "center",
            backdropFilter: "blur(3px)", fontFamily: "Arial, sans-serif"
        });

        const modal = document.createElement("div");
        Object.assign(modal.style, {
            backgroundColor: "white", padding: "25px", borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)", maxWidth: "380px",
            textAlign: "center", animation: "modalFadeIn 0.3s ease-out"
        });

        modal.innerHTML = `
            <style>
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .ext-btn-hover:hover { filter: brightness(1.05); transform: translateY(-1px); }
                .ext-btn-active:active { transform: translateY(1px); }
            </style>
            <div style="font-size: 45px; margin-bottom: 10px; text-shadow: 0 4px 10px rgba(76,175,80,0.3);">📥</div>
            <h2 style="margin: 0 0 10px 0; color: #222; font-size: 20px;">Xác nhận tải hàng loạt</h2>
            <p style="margin: 0 0 20px 0; color: #555; font-size: 15px; line-height: 1.5;">
                Bạn có chắc muốn tải xuống <b>${count} file</b>?
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="ext-cancel-btn" class="ext-btn-hover ext-btn-active" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background-color: #f1f3f4; color: #444; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s;">Hủy</button>
                <button id="ext-confirm-btn" class="ext-btn-hover ext-btn-active" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background-color: #4caf50; color: white; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(76,175,80,0.3);">Đồng ý</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector("#ext-cancel-btn").onclick = () => {
            overlay.remove();
            resolve(false);
        };
        
        modal.querySelector("#ext-confirm-btn").onclick = () => {
            overlay.remove();
            resolve(true);
        };
    });
}

// --- DRAG LOGIC ---
let isDragging = false;
let dragOffsetY = 0;
let dragMoved = false;

fabContainer.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragMoved = false;
    dragOffsetY = e.clientY - fabContainer.getBoundingClientRect().top;
    fabContainer.style.cursor = "grabbing";
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    dragMoved = true;
    const y = e.clientY - dragOffsetY;
    const maxY = window.innerHeight - fabContainer.offsetHeight;

    fabContainer.style.top = Math.max(0, Math.min(y, maxY)) + "px";
    fabContainer.style.right = "12px";
    fabContainer.style.left = "auto";
    fabContainer.style.bottom = "auto";
});

document.addEventListener("mouseup", () => {
    if (isDragging) {
        isDragging = false;
        fabContainer.style.cursor = "grab";
    }
});

const preventClickIfDragged = (e) => {
    if (dragMoved) { dragMoved = false; e.stopImmediatePropagation(); }
};
btn.addEventListener("click", preventClickIfDragged, true);
bulkBtn.addEventListener("click", preventClickIfDragged, true);

// --- BULK DOWNLOAD LOGIC ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

bulkBtn.addEventListener("click", async () => {
    bulkBtn.disabled = true;
    bulkBtn.innerHTML = ICON_LOADING;
    
    let downloadCodes = [];
    
    try {
        if (!isOnFirstPage()) {
            showToast("Đang lùi dần về trang 1...", "info");
            await goToFirstPage();
        }
        
        let currentPage = 1;
        let hasNextPage = true;
        
        while (hasNextPage) {
            showToast(`Đang quét tìm file ở trang ${currentPage}...`, "info");
            
            let analysis = analyzeTables();
            if (analysis.tables.length === 0 || analysis.mainIndex === -1) {
                if (currentPage === 1) showToast("Không tìm thấy bảng dữ liệu nào!", "warning");
                break;
            }
            
            const table = analysis.tables[analysis.mainIndex];
            
            // Tìm cột "Tờ khai" để tải đúng file
            let targetColIndex = -1;
            const headers = table.querySelectorAll("thead th, tr:first-child th, tr:first-child td");
            headers.forEach((th, index) => {
                if (th.innerText.toLowerCase().includes("tờ khai") || th.innerHTML.includes("Tờ khai")) {
                    targetColIndex = index;
                }
            });
            
            const tbody = table.querySelector("tbody") || table;
            const rows = tbody.querySelectorAll("tr");
            
            rows.forEach(row => {
                let cellsToSearch = [];
                // Nếu tìm thấy cột Tờ khai, chỉ lấy ô ở cột đó. Nếu không, quét cả hàng (Fallback)
                if (targetColIndex !== -1 && row.cells.length > targetColIndex) {
                    cellsToSearch.push(row.cells[targetColIndex]);
                } else {
                    cellsToSearch = Array.from(row.cells);
                }
                
                cellsToSearch.forEach(cell => {
                    const links = cell.querySelectorAll("a[href]");
                    links.forEach(link => {
                        let rawHref = link.getAttribute("href") || "";
                        let jsCode = "";
                        if (rawHref.startsWith("javascript:")) {
                            jsCode = rawHref.substring(11).trim();
                            if (jsCode === "void(0)" || jsCode === "void(0);") jsCode = "";
                        }
                        let onclickStr = link.getAttribute("onclick") || "";
                        let execCode = jsCode || onclickStr;
                        
                        // Xác định chính xác đâu là link tải file
                        let isDownloadLink = false;
                        if (window.location.href.includes("traCuuTTHC/seacrchTTHC")) {
                            // Ưu tiên cực cao cho trang Thuế: Chỉ nhặt đúng hàm downloadFile, phớt lờ dsachThongBao, dsachTrangThai
                            isDownloadLink = isAllowedDownloadCode(execCode);
                        } else {
                            // Fallback cho các trang web khác
                            isDownloadLink = isAllowedDownloadCode(execCode);
                        }
                        
                        if (isDownloadLink) {
                            downloadCodes.push({ action: AUTO_DOWNLOAD_ACTION, dataset: copySafeDataset(link.dataset) });
                        } else if (rawHref && !rawHref.startsWith("javascript:") && !rawHref.startsWith("#") && !execCode) {
                            // Chỉ lấy link href thuần nếu nó không có mã js thực thi đi kèm
                            downloadCodes.push({ url: rawHref });
                        }
                    });
                });
            });
            
            const nextBtn = findNextButton();
            if (nextBtn) {
                let sig = getTableSignature();
                simulateClick(nextBtn);
                currentPage++;
                await waitForPageChange(sig);
            } else {
                hasNextPage = false;
            }
        }
        
        if (downloadCodes.length === 0) {
            bulkBtn.innerHTML = ICON_BULK;
            bulkBtn.disabled = false;
            return showToast("Không tìm thấy link tải file nào trong bảng!", "warning");
        }
        
        // Gọi Modal HTML thay vì hàm confirm() nhàm chán của trình duyệt
        const isConfirmed = await showConfirmModal(downloadCodes.length);
        if (!isConfirmed) {
            bulkBtn.innerHTML = ICON_BULK;
            bulkBtn.disabled = false;
            return;
        }
        
        showToast(`Bắt đầu tiến trình tải ${downloadCodes.length} file...`, "info");
        
        for (let i = 0; i < downloadCodes.length; i++) {
            const item = downloadCodes[i];
            showToast(`Đang gửi lệnh tải file ${i + 1}/${downloadCodes.length}...`, "info");
            
            try {
                if (item.url) {
                    const a = document.createElement("a");
                    a.href = item.url;
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } else if (item.action === AUTO_DOWNLOAD_ACTION) {
                    const a = document.createElement("a");
                    a.setAttribute("onclick", buildSafeDownloadOnclick(false));
                    for (let key in item.dataset) {
                        a.dataset[key] = item.dataset[key];
                    }
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
            } catch(e) {
                console.error("Lỗi khi giả lập click:", e);
            }
            
            if (i < downloadCodes.length - 1) {
                await sleep(800); // 800ms là đủ an toàn cho Chrome
            }
        }
        
        showToast(`Đã gửi thành công lệnh tải ${downloadCodes.length} file!`, "success");
        bulkBtn.innerHTML = ICON_BULK;
        bulkBtn.disabled = false;
        
    } catch (error) {
        console.error("Lỗi trong quá trình quét:", error);
        showToast("Có lỗi xảy ra: " + error.message, "error");
        bulkBtn.innerHTML = ICON_BULK;
        bulkBtn.disabled = false;
    }
});



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
        alignment: { horizontal: align, vertical: "center", wrapText: true },
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
                let rawHref = link.getAttribute("href") || "";
                
                // Trường hợp 1: Link tải file hoặc link chuyển trang bình thường
                if (rawHref && !rawHref.startsWith("javascript:") && !rawHref.startsWith("#")) {
                    try {
                        hyperlinkUrl = new URL(rawHref, window.location.href).href;
                    } catch (e) {
                        hyperlinkUrl = link.href;
                    }
                } 
                // Trường hợp 2: Link thực thi JavaScript (SPA)
                else {
                    let jsCode = "";
                    if (rawHref.startsWith("javascript:")) {
                        jsCode = rawHref.substring(11).trim();
                        if (jsCode === "void(0)" || jsCode === "void(0);") jsCode = "";
                    }
                    
                    let onclickStr = link.getAttribute("onclick") || "";
                    let execCode = jsCode || onclickStr;
                    
                    if (isAllowedDownloadCode(execCode)) {
                        try {
                            const url = new URL(window.location.href);
                            url.search = ""; 
                            url.hash = ""; 
                            url.searchParams.set("ext-auto-download", "1");
                            
                            // Nâng cấp: Bọc đoạn mã JS vào Base64!
                            // Lý do: Các tường lửa (WAF) của máy chủ Thuế hoặc bộ quét WinINet của Excel
                            // sẽ chặn đứng cái link (báo lỗi 403 / "Unable to open") nếu thấy trên link 
                            // có dính chữ "downloadFile(" hoặc ký tự code JS lạ. 
                            // Mã hóa Base64 sẽ biến nó thành chuỗi vô hại trong mắt WAF.
                            url.searchParams.set("ext-action", AUTO_DOWNLOAD_ACTION);
                            
                            // Mang theo toàn bộ dataset để mã JavaScript gốc sử dụng (VD: this.dataset.mahso)
                            const safeDataset = copySafeDataset(link.dataset);
                            for (let key in safeDataset) {
                                url.searchParams.set("data-" + key, safeDataset[key]);
                            }
                            hyperlinkUrl = url.href;
                        } catch (e) {
                            console.error("Lỗi tạo URL thực thi JS:", e);
                        }
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

// Tính column widths từ data (hỗ trợ tính riêng từng dòng nếu có xuống dòng)
function autoColWidths(data) {
    if (!data || data.length === 0) return [];
    const numCols = Math.max(...data.map(r => r.length));
    const widths = Array(numCols).fill(10);
    data.forEach(row => {
        row.forEach((cell, i) => {
            const str = String(cell ?? "");
            const lines = str.split('\n');
            const maxLineLen = Math.max(...lines.map(l => l.length));
            if (maxLineLen > widths[i]) widths[i] = maxLineLen;
        });
    });
    // Giới hạn max width = 60 để cột không bị quá rộng, vì đã có wrapText
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

// Hàm kiểm tra thẻ có đang thực sự hiển thị trên màn hình không (Tránh bấm nhầm thẻ ẩn)
function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Hàm click giả lập an toàn để vượt qua các Event Listener của Vue/React/Angular
function simulateClick(el) {
    if (!el) return;
    try {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
        el.click();
    }
}

const PAGE_SELECTORS = ".pagination a, .pagination button, .page-link, ul.pagination li a, .el-pagination button, .el-pager li, .ant-pagination-item a, .paginate_button";

// Tìm nút Prev
function findPrevButton() {
    const elements = document.querySelectorAll(PAGE_SELECTORS);
    for (let el of elements) {
        let text = el.innerText.trim();
        if (isVisible(el) && (text === "‹" || text === "Prev" || text === "Previous" || text === "Trước" || text.toLowerCase() === "prev" || text === "<")) {
            if (el.disabled || el.classList.contains("disabled") || el.parentElement?.classList.contains("disabled") || el.getAttribute("disabled") !== null || el.getAttribute("aria-disabled") === "true") {
                return null;
            }
            return el;
        }
    }
    return null;
}

// Tìm nút Next
function findNextButton() {
    const elements = document.querySelectorAll(PAGE_SELECTORS);
    for (let el of elements) {
        let text = el.innerText.trim();
        if (isVisible(el) && (text === "»" || text === "›" || text === "Next" || text === ">" || text === "Tiếp" || text.toLowerCase() === "next")) {
            if (el.disabled || el.classList.contains("disabled") || el.parentElement?.classList.contains("disabled") || el.getAttribute("disabled") !== null || el.getAttribute("aria-disabled") === "true") {
                return null;
            }
            return el;
        }
    }
    return null;
}

// Hàm tìm nút Trang 1 (kể cả khi đang active/disabled ở trang 1)
function findFirstPageButton() {
    const elements = document.querySelectorAll(PAGE_SELECTORS);
    // ƯU TIÊN TUYỆT ĐỐI: Nút mang số "1"
    for (let el of elements) {
        let text = el.innerText.trim();
        if (text === "1" && isVisible(el)) {
            return el;
        }
    }
    // DỰ PHÒNG: nút First / Đầu
    for (let el of elements) {
        let text = el.innerText.trim();
        if (isVisible(el) && (text === "«" || text === "First" || text === "Đầu" || text.toLowerCase() === "first")) {
            return el;
        }
    }
    return null;
}

// Kiểm tra trang hiện tại có phải trang 1 không
function isOnFirstPage() {
    // Ưu tiên 1: Đọc chính xác số trang đang sáng (active)
    const activeElements = document.querySelectorAll(".page-item.active .page-link, .page-link.active, .pagination .active a, li.active > a, .el-pager li.active, .el-pager li.is-active, .ant-pagination-item-active a, .paginate_button.current");
    for (let el of activeElements) {
        if (isVisible(el)) {
            return el.innerText.trim() === "1";
        }
    }

    // Ưu tiên 2: Nếu không tìm thấy số trang active, mới check nút Prev
    for (let el of document.querySelectorAll(PAGE_SELECTORS)) {
        let text = el.innerText.trim();
        if (isVisible(el) && (text === "Prev" || text === "Previous" || text === "‹" || text === "Trước" || text === "<")) {
            if (el.disabled || el.classList.contains("disabled") || el.parentElement?.classList.contains("disabled") || el.getAttribute("aria-disabled") === "true") {
                return true;
            }
        }
    }
    return false;
}

function getTableSignature() {
    const tables = document.querySelectorAll("table");
    let mainTable = null;
    let maxRows = 0;
    tables.forEach(table => {
        const rowCount = table.rows.length;
        if (rowCount > maxRows) {
            maxRows = rowCount;
            mainTable = table;
        }
    });
    return mainTable ? mainTable.innerText : "";
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

// Hàm lùi về trang 1 một cách kiên nhẫn
async function goToFirstPage() {
    let attempts = 0;
    while (!isOnFirstPage() && attempts < 50) {
        attempts++;
        
        let firstPageBtn = findFirstPageButton();
        if (firstPageBtn) {
            let sig = getTableSignature();
            simulateClick(firstPageBtn);
            await waitForPageChange(sig);
            
            // Cú click đầu tiên có thể là nút "1" nên về thẳng đích luôn
            if (isOnFirstPage()) break; 
        }
        
        // Nếu nút First không ăn thua hoặc không có, bấm nút lùi
        let prevBtn = findPrevButton();
        if (prevBtn) {
            let sig = getTableSignature();
            simulateClick(prevBtn);
            await waitForPageChange(sig);
        } else {
            break; // Bó tay
        }
    }
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
if (window.__EXPORT_EXCEL_EXTENSION_TEST_MODE__) {
    window.__EXPORT_EXCEL_EXTENSION_TEST__ = {
        AUTO_DOWNLOAD_ACTION,
        SAFE_DOWNLOAD_CALL,
        isAllowedDownloadCode,
        copySafeDataset,
        buildSafeDownloadOnclick,
        showToast,
        hideToast,
        rgbToHex,
        getCellStyle,
        extractTableWithStyles,
        autoColWidths,
        buildSheet,
        isVisible,
        simulateClick,
        findPrevButton,
        findNextButton,
        findFirstPageButton,
        isOnFirstPage,
        getTableSignature,
        waitForPageChange,
        goToFirstPage,
        analyzeTables,
        _elements: { fabContainer, btn, bulkBtn }
    };
}

btn.addEventListener("click", async () => {
    btn.innerHTML = ICON_LOADING;
    btn.style.backgroundColor = "#607d8b";
    btn.disabled = true;

    try {
        showToast("Đang chuẩn bị xuất dữ liệu...", "info");

        // Quay về trang 1 trước nếu chưa ở trang 1
        if (!isOnFirstPage()) {
            showToast("Đang lùi dần về trang 1...", "info");
            await goToFirstPage();
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
                simulateClick(nextBtn);
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
