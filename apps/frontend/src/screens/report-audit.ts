// Denetim kaydi (audit-log) gorunum yardimcilari. oldValue/newValue guvenilmez
// JSON string oldugundan parse try/catch ile korunur (parser yolu).

export interface AuditRowLite {
  action: string;
  entityType: string;
  oldValue: string | null;
  newValue: string | null;
}

export const ENTITY_LABEL: Record<string, string> = {
  product: 'Ürün',
  category: 'Kategori',
  unit: 'Birim',
  tax: 'Vergi',
  order: 'Sipariş',
  payment: 'Ödeme',
  customer: 'Müşteri',
  table: 'Masa',
  user: 'Kullanıcı',
};
const VERB_LABEL: Record<string, string> = {
  create: 'eklendi',
  update: 'güncellendi',
  delete: 'silindi',
};

// newValue -> oldValue sirasiyla JSON'dan okunabilir bir ad cikar (yoksa '').
export function entryName(row: AuditRowLite): string {
  for (const raw of [row.newValue, row.oldValue]) {
    if (!raw) continue;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o.name === 'string') return o.name;
    } catch {
      /* JSON degilse gec */
    }
  }
  return '';
}

// 'product.create' -> 'Ürün eklendi'. Bilinmeyen -> entityType + ham fiil.
export function actionLabel(row: AuditRowLite): string {
  const [entity, verb] = row.action.split('.');
  const e = ENTITY_LABEL[entity ?? ''] ?? row.entityType;
  const v = VERB_LABEL[verb ?? ''] ?? verb ?? '';
  return `${e} ${v}`.trim();
}
