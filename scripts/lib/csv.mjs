// Tiny CSV writer for the export commands (issue #18). Plain Node, no dependencies.
// Output follows RFC 4180 (comma separated, CRLF line ends, quotes doubled) and starts with a
// UTF-8 byte-order mark so Excel opens accented text correctly.

/**
 * One CSV field. Quoted when it holds a comma, quote, line break or edge spaces. With `text: true`
 * the value is user-typed text, and one that starts with = + - @ or a tab is prefixed with an
 * apostrophe so a spreadsheet shows it as text instead of running it as a formula.
 */
export function csvField(value, { text = false } = {}) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV from `columns` ({ header, get(row), text? }) and `rows`. Always has the header
 * line, even with no rows.
 */
export function toCsv(columns, rows) {
  const line = (cells) => cells.join(",");
  const lines = [line(columns.map((c) => csvField(c.header)))];
  for (const row of rows) lines.push(line(columns.map((c) => csvField(c.get(row), { text: c.text }))));
  return `﻿${lines.join("\r\n")}\r\n`;
}
