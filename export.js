'use strict';

/**
 * 数据导出工具：
 *  - recordsToCsv：账单记录 -> CSV 文本（带 UTF-8 BOM，Excel/Numbers 可直接打开）
 *  - timestampName：生成带时间戳的文件名，如 做账账单-20260825-153000.csv
 */

const BOM = '\uFEFF';

const CSV_HEADERS = ['id', 'date', 'amount', 'currency', 'category', 'type', 'path', 'note', 'created_time'];

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function recordsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => csvEscape(r[h])).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

function timestampName(prefix, ext, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  const t = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `${prefix}-${d}-${t}.${ext}`;
}

module.exports = { recordsToCsv, timestampName, CSV_HEADERS };
