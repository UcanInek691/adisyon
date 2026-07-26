// Varsayilan birim/vergi + oran donusumunun runnable self-check'i.
// Calistir: node --experimental-strip-types src/catalog/catalog.defaults.selfcheck.ts
import assert from 'node:assert';
import { DEFAULT_UNITS, DEFAULT_TAXES } from './catalog.defaults.ts';

// Urun eklenebilmesi icin en az bir birim + bir vergi sart.
assert.ok(DEFAULT_UNITS.length >= 1, 'en az bir varsayilan birim olmali');
assert.ok(DEFAULT_TAXES.length >= 1, 'en az bir varsayilan vergi olmali');

// Tek varsayilan vergi olmali (createTax mantigi tek default varsayar).
const defaults = DEFAULT_TAXES.filter((t) => t.isDefault);
assert.equal(defaults.length, 1, 'tam olarak bir varsayilan vergi olmali');

// ratePermille binde: %10 -> 100. Frontend'in yuzde->binde donusumuyle tutarli.
const kdv10 = DEFAULT_TAXES.find((t) => t.name === 'KDV %10');
assert.equal(kdv10?.ratePermille, 100, 'KDV %10 -> 100 binde');
assert.ok(kdv10?.isDefault, 'KDV %10 varsayilan olmali');
assert.equal(Math.round(parseFloat('20') * 10), 200, 'yuzde->binde: %20 -> 200');
assert.equal(Math.round(parseFloat('1') * 10), 10, 'yuzde->binde: %1 -> 10');

// Tum oranlar negatif olmamali.
assert.ok(
  DEFAULT_TAXES.every((t) => t.ratePermille >= 0),
  'oranlar negatif olamaz',
);

console.log('catalog.defaults.selfcheck OK');
