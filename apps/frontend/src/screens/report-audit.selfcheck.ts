// Denetim gorunum yardimcilarinin runnable self-check'i (JSON parser yolu).
// Calistir: node --experimental-strip-types src/screens/report-audit.selfcheck.ts
import assert from 'node:assert';
import { entryName, actionLabel } from './report-audit.ts';

// Bilinen entity+fiil -> Turkce etiket.
assert.equal(
  actionLabel({ action: 'product.create', entityType: 'product', oldValue: null, newValue: null }),
  'Ürün eklendi',
);
assert.equal(
  actionLabel({ action: 'tax.delete', entityType: 'tax', oldValue: null, newValue: null }),
  'Vergi silindi',
);
// Bilinmeyen -> entityType + ham fiil (cokme yok).
assert.equal(
  actionLabel({ action: 'stock.adjust', entityType: 'stock', oldValue: null, newValue: null }),
  'stock adjust',
);

// newValue JSON'undan ad cikar.
assert.equal(
  entryName({
    action: 'unit.create',
    entityType: 'unit',
    oldValue: null,
    newValue: '{"name":"Adet"}',
  }),
  'Adet',
);
// newValue yoksa oldValue'dan (silme kaydi).
assert.equal(
  entryName({
    action: 'unit.delete',
    entityType: 'unit',
    oldValue: '{"name":"Litre"}',
    newValue: null,
  }),
  'Litre',
);
// Bozuk JSON -> cokme yok, bos string.
assert.equal(entryName({ action: 'x.y', entityType: 'x', oldValue: 'bozuk{', newValue: null }), '');
// Ad alani yoksa bos.
assert.equal(
  entryName({ action: 'x.y', entityType: 'x', oldValue: null, newValue: '{"id":"1"}' }),
  '',
);

console.log('report-audit.selfcheck OK');
