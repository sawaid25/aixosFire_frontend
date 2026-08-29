/**
 * Tiny dependency-free CSV reader/writer (RFC 4180-ish).
 *
 * Handles: quoted fields, embedded commas / newlines / doubled-quotes inside
 * quotes, a leading UTF-8 BOM, and both \n and \r\n line endings — i.e. what
 * Excel / Google Sheets / Numbers actually produce. It is intentionally small:
 * the bulk-import flow only needs a handful of short text columns.
 */

/** Parse CSV text → { headers: string[], rows: Array<Record<string,string>> }. */
export function parseCsv(text) {
    if (typeof text !== 'string') return { headers: [], rows: [] };
    // Strip UTF-8 BOM if present.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const records = [];
    let field = '';
    let record = [];
    let inQuotes = false;
    let i = 0;
    const n = text.length;

    const endField = () => { record.push(field); field = ''; };
    const endRecord = () => { endField(); records.push(record); record = []; };

    while (i < n) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += c; i++; continue;
        }
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ',') { endField(); i++; continue; }
        if (c === '\r') { // \r or \r\n
            endRecord();
            i += text[i + 1] === '\n' ? 2 : 1;
            continue;
        }
        if (c === '\n') { endRecord(); i++; continue; }
        field += c; i++;
    }
    // Flush trailing field/record (unless the file ended on a clean newline).
    if (field.length > 0 || record.length > 0) endRecord();

    // Drop fully-empty trailing records.
    while (records.length && records[records.length - 1].every((v) => v.trim() === '')) {
        records.pop();
    }
    if (!records.length) return { headers: [], rows: [] };

    const headers = records[0].map((h) => h.trim());
    const rows = records.slice(1)
        .filter((r) => r.some((v) => v.trim() !== '')) // skip blank lines between rows
        .map((r) => {
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
            return obj;
        });
    return { headers, rows };
}

/** Escape one CSV cell. */
function csvCell(value) {
    const s = value == null ? '' : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build CSV text from a header list + array of row objects.
 * Rows are keyed by header name; missing keys become empty cells.
 */
export function toCsv(headers, rows) {
    const lines = [headers.map(csvCell).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => csvCell(row[h])).join(','));
    }
    // CRLF — friendliest for Excel on Windows.
    return lines.join('\r\n') + '\r\n';
}

/** Trigger a browser download of a text file. */
export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob(['﻿', text], { type: mime }); // BOM so Excel reads UTF-8
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
