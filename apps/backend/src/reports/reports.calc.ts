import assert from 'node:assert';

// Gun sonu saati (vars. 06:00 — CONVENTIONS.md; orders.service ile ayni).
// ponytail: sabit; ileride ApplicationSetting'ten okunacak.
const DAY_END_HOUR = 6;

/**
 * YYYY-MM-DD is-gunu penceresi (SAF): [date 06:00, ertesi 06:00).
 * CashSession.businessDay ile ayni gun tanimi. Gecersiz tarihte bugunun is-gunu.
 */
export function businessDayWindow(dateStr: string): { day: string; start: Date; end: Date } {
  const parsed = new Date(`${dateStr}T00:00:00`);
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const start = new Date(base);
  start.setHours(DAY_END_HOUR, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const day =
    `${start.getFullYear()}-` +
    `${String(start.getMonth() + 1).padStart(2, '0')}-` +
    `${String(start.getDate()).padStart(2, '0')}`;
  return { day, start, end };
}

// --- Self-check: `ts-node src/reports/reports.calc.ts` ---
if (require.main === module) {
  const w = businessDayWindow('2026-07-17');
  assert.strictEqual(w.day, '2026-07-17', 'gun');
  assert.strictEqual(w.start.getHours(), DAY_END_HOUR, 'baslangic 06:00');
  assert.strictEqual(w.end.getDate(), 18, 'bitis ertesi gun');
  assert.ok(w.end > w.start, 'end > start');

  // Gecersiz tarih -> bugunun is-gunu (crash yok).
  const fallback = businessDayWindow('');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(fallback.day), 'gecersiz tarih fallback');

  console.log('✓ reports.calc self-check OK');
}
