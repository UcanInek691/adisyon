// Yeni kurulumda urun eklenebilmesi icin sart olan varsayilan birim ve vergiler.
// Urun formu birim+vergi ZORUNLU tutar; bunlar bos olursa hic urun eklenemez
// (kok neden buydu). Bootstrap bu listeyi bos sube DB'sine yazar.
// Turkiye restoran/kafe icin makul varsayilanlar; kullanici Ayarlar'dan degistirir.

export const DEFAULT_UNITS: { name: string; abbreviation: string }[] = [
  { name: 'Adet', abbreviation: 'Ad' },
  { name: 'Porsiyon', abbreviation: 'Prs' },
  { name: 'Kilogram', abbreviation: 'kg' },
  { name: 'Gram', abbreviation: 'g' },
  { name: 'Litre', abbreviation: 'L' },
  { name: 'Şişe', abbreviation: 'Şşe' },
  { name: 'Bardak', abbreviation: 'Brd' },
];

// ratePermille: binde. %10 -> 100, %20 -> 200, %1 -> 10, %0 -> 0.
export const DEFAULT_TAXES: { name: string; ratePermille: number; isDefault?: boolean }[] = [
  { name: 'KDV %0', ratePermille: 0 },
  { name: 'KDV %1', ratePermille: 10 },
  { name: 'KDV %10', ratePermille: 100, isDefault: true },
  { name: 'KDV %20', ratePermille: 200 },
];
