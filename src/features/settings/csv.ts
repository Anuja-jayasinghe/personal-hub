/**
 * CSV for the downloads on Settings › Data and backup (S.7, C113). Pure.
 * Every value is quoted when needed, and a value that a spreadsheet would run as a formula (starting
 * with =, +, - or @, or a tab or carriage return) gets a leading apostrophe, so opening an export
 * can never run something typed into a note.
 */
export type Cell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: the header row, then one line per row, with Windows line ends so Excel is happy. */
export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
