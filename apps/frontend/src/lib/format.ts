// Para = integer kurus. Miktar = integer milis (x1000). Float YASAK (sunum haric).
const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export function formatKurus(kurus: number): string {
  return tl.format(kurus / 100);
}

// milis -> insan-okur miktar. Tam adetse tamsayi, degilse 3 hane.
export function formatQty(milis: number): string {
  const q = milis / 1000;
  return Number.isInteger(q) ? String(q) : q.toFixed(3);
}
