/**
 * CSV as RFC 4180 has it: fields separated by commas, quoted when they hold a
 * comma, a quote or a line break, with quotes doubled inside quotes. The USGS
 * writes its search results this way and spreadsheets read exports this way.
 *
 * Hand-written because both ends are known and small: a page of the USGS
 * search is parsed whole, and an export writes one row at a time.
 */

export type CsvValue = string | number | null;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);

    if (quoted) {
      if (char !== '"') field += char;
      else if (text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * A spreadsheet runs a cell that starts with one of these as a formula, so a
 * place name such as `=HYPERLINK(…)` would execute on opening: OWASP's CSV
 * injection. Text cells that start this way get a leading apostrophe; numbers
 * are written as numbers, so a negative depth stays a number.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);

  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One record, with the CRLF line ending RFC 4180 asks for. */
export function csvLine(values: readonly CsvValue[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}
