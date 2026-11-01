export type CsvRecord = Record<string, string>;

/**
 * Minimal RFC 4180 parser: header row, quoted fields, "" escapes, CRLF or LF, optional BOM.
 * Blank lines are skipped. Throws on a row whose column count differs from the header.
 */
export function parseCsv(text: string): CsvRecord[] {
  const rows = splitRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];

  const header = rows[0].fields.map((h) => h.trim());
  return rows.slice(1).map(({ fields, line }) => {
    if (fields.length !== header.length) {
      throw new Error(`Line ${line}: expected ${header.length} columns, found ${fields.length}.`);
    }
    return Object.fromEntries(header.map((key, i) => [key, fields[i]]));
  });
}

interface RawRow {
  fields: string[];
  line: number;
}

function splitRows(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const endRow = () => {
    fields.push(field);
    const isBlank = fields.length === 1 && fields[0].trim() === '';
    if (!isBlank) rows.push({ fields, line: rowStartLine });
    fields = [];
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStartLine = line;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error(`Line ${rowStartLine}: unterminated quoted field.`);
  if (field !== '' || fields.length > 0) endRow();
  return rows;
}
