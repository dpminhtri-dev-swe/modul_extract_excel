const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class ClassList {
    constructor(element) {
        this.element = element;
    }

    contains(name) {
        return (this.element.attributes.class || "")
            .split(/\s+/)
            .filter(Boolean)
            .includes(name);
    }
}

class TestElement {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentElement = null;
        this.attributes = {};
        this.dataset = {};
        this.style = {};
        this.disabled = false;
        this.textContent = "";
        this._innerHTML = "";
        this.listeners = {};
        this.classList = new ClassList(this);
        this.offsetWidth = 10;
        this.offsetHeight = 10;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
        this.parentElement = null;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "disabled") this.disabled = true;
        if (name.startsWith("data-")) this.dataset[name.slice(5)] = String(value);
    }

    getAttribute(name) {
        if (name === "disabled" && this.disabled) return "";
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }

    addEventListener(type, handler) {
        this.listeners[type] ||= [];
        this.listeners[type].push(handler);
    }

    dispatchEvent(event) {
        for (const handler of this.listeners[event.type] || []) {
            handler.call(this, event);
        }
        return true;
    }

    click() {
        this.clicked = (this.clicked || 0) + 1;
        this.dispatchEvent({ type: "click" });
    }

    getClientRects() {
        return this.offsetWidth || this.offsetHeight ? [{}] : [];
    }

    get rows() {
        return this.querySelectorAll("tr");
    }

    get cells() {
        return this.children.filter((child) => child.tagName === "TD" || child.tagName === "TH");
    }

    get innerText() {
        if (this.textContent) return this.textContent;
        return this.children.map((child) => child.innerText).join("");
    }

    set innerText(value) {
        this.textContent = String(value);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        if (!this.textContent) this.textContent = String(value).replace(/<[^>]*>/g, "");
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        return querySelectorAll(this, selector);
    }
}

function descendants(root) {
    const out = [];
    for (const child of root.children || []) {
        out.push(child);
        out.push(...descendants(child));
    }
    return out;
}

function hasClass(el, className) {
    return el.classList.contains(className);
}

function hasAncestorClass(el, className) {
    let cur = el.parentElement;
    while (cur) {
        if (hasClass(cur, className)) return true;
        cur = cur.parentElement;
    }
    return false;
}

function hasAncestorTag(el, tagName) {
    let cur = el.parentElement;
    while (cur) {
        if (cur.tagName === tagName) return true;
        cur = cur.parentElement;
    }
    return false;
}

function previousSibling(el) {
    if (!el.parentElement) return null;
    const siblings = el.parentElement.children;
    return siblings[siblings.indexOf(el) - 1] || null;
}

function matchesSimple(el, selector) {
    selector = selector.trim();
    if (selector === "table") return el.tagName === "TABLE";
    if (selector === "tbody") return el.tagName === "TBODY";
    if (selector === "tr") return el.tagName === "TR";
    if (selector === "th") return el.tagName === "TH";
    if (selector === "td") return el.tagName === "TD";
    if (selector === "th, td") return el.tagName === "TH" || el.tagName === "TD";
    if (selector === "a[href]") return el.tagName === "A" && el.getAttribute("href") !== null;
    if (selector === ".page-link") return hasClass(el, "page-link");
    if (selector === ".page-link.active") return hasClass(el, "page-link") && hasClass(el, "active");
    if (selector === ".paginate_button.current") return hasClass(el, "paginate_button") && hasClass(el, "current");
    if (selector === "li.active > a") return el.tagName === "A" && el.parentElement?.tagName === "LI" && hasClass(el.parentElement, "active");
    if (selector === ".page-item.active .page-link") return hasClass(el, "page-link") && hasAncestorClass(el, "active");
    if (selector === ".pagination .active a") return el.tagName === "A" && hasAncestorClass(el, "active") && hasAncestorClass(el, "pagination");
    if (selector === ".pagination a") return el.tagName === "A" && hasAncestorClass(el, "pagination");
    if (selector === ".pagination button") return el.tagName === "BUTTON" && hasAncestorClass(el, "pagination");
    if (selector === "ul.pagination li a") return el.tagName === "A" && el.parentElement?.tagName === "LI" && hasAncestorClass(el, "pagination");
    if (selector === ".el-pagination button") return el.tagName === "BUTTON" && hasAncestorClass(el, "el-pagination");
    if (selector === ".el-pager li") return el.tagName === "LI" && hasAncestorClass(el, "el-pager");
    if (selector === ".el-pager li.active" || selector === ".el-pager li.is-active") {
        return el.tagName === "LI" && hasAncestorClass(el, "el-pager") && (hasClass(el, "active") || hasClass(el, "is-active"));
    }
    if (selector === ".ant-pagination-item a") return el.tagName === "A" && hasAncestorClass(el, "ant-pagination-item");
    if (selector === ".ant-pagination-item-active a") return el.tagName === "A" && hasAncestorClass(el, "ant-pagination-item-active");
    if (selector === "thead th") return el.tagName === "TH" && hasAncestorTag(el, "THEAD");
    if (selector === "tr:first-child th") return el.tagName === "TH" && el.parentElement?.tagName === "TR" && !previousSibling(el.parentElement);
    if (selector === "tr:first-child td") return el.tagName === "TD" && el.parentElement?.tagName === "TR" && !previousSibling(el.parentElement);
    return false;
}

function querySelectorAll(root, selector) {
    const selectors = selector.split(",").map((part) => part.trim()).filter(Boolean);
    const nodes = descendants(root);
    return nodes.filter((node, index) => selectors.some((part) => matchesSimple(node, part)) && nodes.indexOf(node) === index);
}

class TestDocument extends TestElement {
    constructor() {
        super("#document", null);
        this.ownerDocument = this;
        this.documentElement = this.createElement("html");
        this.head = this.createElement("head");
        this.body = this.createElement("body");
        this.appendChild(this.documentElement);
        this.documentElement.appendChild(this.head);
        this.documentElement.appendChild(this.body);
    }

    createElement(tagName) {
        return new TestElement(tagName, this);
    }

    getElementById(id) {
        return descendants(this).find((el) => el.attributes.id === id) || null;
    }

    addEventListener() {}
}

function mockXlsx() {
    const colName = (index) => String.fromCharCode(65 + index);
    return {
        utils: {
            aoa_to_sheet(data) {
                const ws = {};
                data.forEach((row, r) => {
                    row.forEach((value, c) => {
                        ws[`${colName(c)}${r + 1}`] = { v: value, t: "s" };
                    });
                });
                if (data.length) {
                    ws["!ref"] = `A1:${colName(Math.max(...data.map((row) => row.length)) - 1)}${data.length}`;
                }
                return ws;
            },
            decode_range(ref) {
                const match = /^A1:([A-Z])(\d+)$/.exec(ref);
                return { s: { r: 0, c: 0 }, e: { r: Number(match[2]) - 1, c: match[1].charCodeAt(0) - 65 } };
            },
            encode_cell({ r, c }) {
                return `${colName(c)}${r + 1}`;
            },
            book_new() {
                return {};
            },
            book_append_sheet() {}
        },
        writeFile() {}
    };
}

function loadExtension(url = "https://dichvucongcbt.gdt.gov.vn/traCuuTTHC/seacrchTTHC") {
    const document = new TestDocument();
    const window = {
        document,
        location: new URL(url),
        history: {
            pushState() {},
            replaceState() {}
        },
        addEventListener() {},
        getComputedStyle(el) {
            return {
                backgroundColor: el.style.backgroundColor || "rgba(0, 0, 0, 0)",
                color: el.style.color || "rgb(0, 0, 0)",
                fontWeight: el.style.fontWeight || "400",
                fontStyle: el.style.fontStyle || "normal",
                fontSize: el.style.fontSize || "16px",
                textAlign: el.style.textAlign || "left",
                borderBottomColor: el.style.borderBottomColor || "rgb(204, 204, 204)"
            };
        },
        __EXPORT_EXCEL_EXTENSION_TEST_MODE__: true
    };
    window.window = window;
    window.URL = URL;
    document.defaultView = window;

    const context = {
        window,
        document,
        location: window.location,
        history: window.history,
        URL,
        console,
        XLSX: mockXlsx(),
        performance: { getEntriesByType: () => [{ name: url }] },
        setTimeout: (fn) => {
            if (typeof fn === "function") fn();
            return 1;
        },
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        queueMicrotask: (fn) => fn(),
        MouseEvent: function MouseEvent(type, init) {
            return { type, ...init };
        },
        atob: (value) => Buffer.from(value, "base64").toString("binary"),
        decodeURIComponent
    };

    const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    vm.runInNewContext(source, context, { filename: "content.js" });
    return { api: window.__EXPORT_EXCEL_EXTENSION_TEST__, document, window };
}

function table(document, rows, { th = true } = {}) {
    const t = document.createElement("table");
    const tbody = document.createElement("tbody");
    t.appendChild(tbody);
    rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tbody.appendChild(tr);
        row.forEach((text) => {
            const cell = document.createElement(th && rowIndex === 0 ? "th" : "td");
            cell.innerText = text;
            tr.appendChild(cell);
        });
    });
    return t;
}

test("download code whitelist rejects executable input outside the expected call", () => {
    const { api } = loadExtension();
    assert.equal(api.isAllowedDownloadCode("downloadFile(this.dataset)"), true);
    assert.equal(api.isAllowedDownloadCode(" downloadFile( this.dataset ); return false; "), true);
    assert.equal(api.isAllowedDownloadCode("downloadFile(window.dataset)"), false);
    assert.equal(api.isAllowedDownloadCode("downloadFile(this.dataset); alert(1)"), false);
    assert.equal(api.isAllowedDownloadCode("fetch('/steal')"), false);
    assert.equal(api.buildSafeDownloadOnclick(true).includes("eval"), false);
});

test("dataset copy only keeps safe bounded string keys", () => {
    const { api } = loadExtension();
    const copied = api.copySafeDataset({
        safe_key1: 123,
        "bad-key": "drop",
        [("x").repeat(65)]: "drop",
        big: "a".repeat(3000)
    });
    assert.deepEqual(Object.keys(copied).sort(), ["big", "safe_key1"]);
    assert.equal(copied.safe_key1, "123");
    assert.equal(copied.big.length, 2048);
});

test("style and width helpers handle invalid colors, multiline text and max width", () => {
    const { api } = loadExtension();
    assert.equal(api.rgbToHex("rgb(12, 34, 255)"), "0C22FF");
    assert.equal(api.rgbToHex("transparent"), null);
    assert.equal(api.rgbToHex("not-a-color"), null);
    assert.equal(JSON.stringify(api.autoColWidths([])), "[]");
    assert.equal(JSON.stringify(api.autoColWidths([["short", "line1\nlonger-line"], ["x".repeat(100), "ok"]])), JSON.stringify([{ wch: 60 }, { wch: 13 }]));
});

test("buildSheet renumbers STT and preserves hyperlinks/styles", () => {
    const { api } = loadExtension();
    const styles = [
        [{ font: {}, alignment: {} }, { font: {}, alignment: {} }],
        [{ font: {}, alignment: {} }, { font: { color: { rgb: "0000FF" }, underline: true }, _hyperlink: "https://example.test/file" }],
        [{ font: {}, alignment: {} }, { font: {}, alignment: {} }]
    ];
    const ws = api.buildSheet([
        ["STT", "File"],
        ["9", "A"],
        ["9", "B"]
    ], styles);
    assert.equal(ws.A2.v, "1");
    assert.equal(ws.A3.v, "2");
    assert.equal(ws.B2.l.Target, "https://example.test/file");
    assert.equal(ws["!cols"].length, 2);
});

test("table analysis ignores layout tables and picks the largest valid data table", () => {
    const { api, document } = loadExtension();
    document.body.appendChild(table(document, [["layout only"]]));
    document.body.appendChild(table(document, [["H"], ["A"]]));
    const main = table(document, [["H"], ["A"], ["B"], ["C"]]);
    document.body.appendChild(main);
    const analysis = api.analyzeTables();
    assert.equal(analysis.tables.length, 2);
    assert.equal(analysis.tables[analysis.mainIndex], main);
    assert.equal(api.getTableSignature(), "HABC");
});

test("pagination helpers respect active and disabled states", () => {
    const { api, document } = loadExtension();
    const pagination = document.createElement("div");
    pagination.setAttribute("class", "pagination");
    const prev = document.createElement("button");
    prev.innerText = "Prev";
    prev.disabled = true;
    const page1 = document.createElement("button");
    page1.innerText = "1";
    page1.setAttribute("class", "active page-link");
    const next = document.createElement("button");
    next.innerText = "Next";
    pagination.appendChild(prev);
    pagination.appendChild(page1);
    pagination.appendChild(next);
    document.body.appendChild(pagination);

    assert.equal(api.isOnFirstPage(), true);
    assert.equal(api.findPrevButton(), null);
    assert.equal(api.findFirstPageButton(), page1);
    assert.equal(api.findNextButton(), next);

    next.setAttribute("aria-disabled", "true");
    assert.equal(api.findNextButton(), null);
});

test("extractTableWithStyles skips repeated header and converts safe JS links to auto-download URLs", () => {
    const { api, document } = loadExtension("https://dichvucongcbt.gdt.gov.vn/traCuuTTHC/seacrchTTHC?page=2#hash");
    const t = table(document, [["STT", "To khai"], ["1", ""]]);
    const linkCell = t.querySelectorAll("td")[1];
    const link = document.createElement("a");
    link.setAttribute("href", "javascript:void(0)");
    link.setAttribute("onclick", "downloadFile(this.dataset)");
    link.dataset.mahso = "ABC";
    link.innerText = "Tai file";
    linkCell.appendChild(link);

    const extracted = api.extractTableWithStyles(t, true);
    assert.equal(JSON.stringify(extracted.data), JSON.stringify([["1", "Tai file"]]));
    const target = new URL(extracted.styles[0][1]._hyperlink);
    assert.equal(target.searchParams.get("ext-auto-download"), "1");
    assert.equal(target.searchParams.get("ext-action"), api.AUTO_DOWNLOAD_ACTION);
    assert.equal(target.searchParams.get("data-mahso"), "ABC");
});

test("core sheet operations stay within a practical performance budget", () => {
    const { api } = loadExtension();
    const rows = [["STT", "Name", "Note"]];
    const styles = [[{}, {}, {}]];
    for (let i = 1; i <= 5000; i++) {
        rows.push([String(i), `Name ${i}`, "x".repeat(i % 80)]);
        styles.push([{}, {}, {}]);
    }
    const started = performance.now();
    const ws = api.buildSheet(rows, styles);
    const elapsed = performance.now() - started;
    assert.equal(ws.A5001.v, "5000");
    assert.ok(elapsed < 1500, `buildSheet took ${elapsed}ms`);
});
