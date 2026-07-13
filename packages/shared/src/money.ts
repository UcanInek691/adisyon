/**
 * Para ve miktar yardimcilari.
 *
 * KURAL (DATABASE_DESIGN.md §0):
 *  - Para: integer "kurus" (minor unit). Float YASAK.
 *  - Miktar: integer "milis" (adet/kg x 1000). 0.75 kg -> 750.
 *  - Vergi/indirim orani: integer "binde" (permille). %10 -> 100.
 */

/** Para birimi: integer kurus. 12.50 TL -> 1250 */
export type MoneyMinor = number;

/** Miktar: integer x1000. 1 adet -> 1000, 0.75 kg -> 750 */
export type QuantityMilli = number;

/** Oran: integer binde. %10 -> 100, %20 -> 200 */
export type RatePermille = number;

export const MONEY_SCALE = 100;
export const QUANTITY_SCALE = 1000;
export const PERMILLE_SCALE = 1000;

/** TL (major) -> kurus (minor). 12.5 -> 1250 */
export function toMinor(major: number): MoneyMinor {
  return Math.round(major * MONEY_SCALE);
}

/** kurus -> TL (major). 1250 -> 12.5 */
export function toMajor(minor: MoneyMinor): number {
  return minor / MONEY_SCALE;
}

/** Insan miktari -> milis. 0.75 -> 750 */
export function toMilliQuantity(qty: number): QuantityMilli {
  return Math.round(qty * QUANTITY_SCALE);
}

/** milis -> insan miktari. 750 -> 0.75 */
export function fromMilliQuantity(milli: QuantityMilli): number {
  return milli / QUANTITY_SCALE;
}

/**
 * Bir satirin toplamini kurus cinsinden hesaplar.
 * Butun carpim tam sayida yapilir, en sonda tek yuvarlama ile float hatasi engellenir.
 */
export function lineTotal(unitPriceMinor: MoneyMinor, quantityMilli: QuantityMilli): MoneyMinor {
  return Math.round((unitPriceMinor * quantityMilli) / QUANTITY_SCALE);
}

/** Binde oran uzerinden vergi/indirim tutari (kurus). base=1000 kurus, %10 -> 100 kurus */
export function applyPermille(baseMinor: MoneyMinor, ratePermille: RatePermille): MoneyMinor {
  return Math.round((baseMinor * ratePermille) / PERMILLE_SCALE);
}
