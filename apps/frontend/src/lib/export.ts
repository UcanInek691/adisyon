// Rapor çıktısı: CSV (Excel açar) üretimi. Türkiye Windows Excel'i liste ayracı
// olarak ';' kullanır; UTF-8 BOM ile Türkçe karakterler bozulmaz.

const SEP = ';';

// Bir hücreyi CSV-güvenli hale getir: ayraç/tırnak/yeni satır içeriyorsa tırnakla.
function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (s.includes('"') || s.includes(SEP) || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(SEP));
  return '﻿' + lines.join('\r\n'); // BOM + CRLF (Excel dostu)
}

// Tarayıcıda CSV dosyası indir. filename'e .csv eklenir (yoksa).
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
