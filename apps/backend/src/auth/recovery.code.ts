import assert from 'node:assert';
import { randomInt, timingSafeEqual } from 'node:crypto';

// Kurtarma kodu: sahibi sifresini unuttugunda kullanacagi tek metin.
// Bicim: XXXX-XXXX-XXXX-XXXX (16 karakter, Crockford base32 benzeri alfabe).
//
// Alfabede I/L/O/U yok: elle yazilirken 1/I, 0/O karismasin diye. Kalan 32
// karakter x 16 hane = 80 bit -> kaba kuvvet imkansiz (argon2 dogrulamasiyla
// birlikte saniyede bir kac deneme bile yapilamaz), bu yuzden ayrica deneme
// sayaci/kilit tutulmuyor.
//
// ponytail: sayac yok — 80 bit + argon2 yeterli. Uc internete acilirsa
// (su an sadece LAN) hiz siniri eklenmeli.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // I, L, O, U yok
const GROUPS = 4;
const GROUP_LEN = 4;

/** Kriptografik rastgele yeni kurtarma kodu (kullaniciya BIR KEZ gosterilir). */
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = '';
    for (let i = 0; i < GROUP_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return groups.join('-');
}

/**
 * Kullanici girdisini karsilastirilabilir hale getirir: bosluk/tire temizlenir,
 * buyuk harfe cevrilir, karisan harfler duzeltilir (l->1, o->0 gibi).
 * Gecersiz uzunluk/karakter -> null.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
  if (cleaned.length !== GROUPS * GROUP_LEN) return null;
  if (![...cleaned].every((c) => ALPHABET.includes(c))) return null;
  return cleaned;
}

/** Sabit sureli karsilastirma (kod uzunlugu sabit oldugu icin guvenli). */
export function recoveryCodesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// --- self-check: `ts-node src/auth/recovery.code.ts` ---
if (require.main === module) {
  const code = generateRecoveryCode();
  assert.match(code, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/, `bicim: ${code}`);
  assert.ok(!/[ILOU]/.test(code), 'karisan harfler uretilmemeli');

  // Kodun kendisi normalize edilince tireleri dusmus haline esit olmali.
  const norm = normalizeRecoveryCode(code);
  assert.strictEqual(norm, code.replace(/-/g, ''));

  // Kullanici yazim varyasyonlari ayni koda cozulmeli.
  const target = normalizeRecoveryCode('ABCD-1234-EFGH-5678')!;
  for (const variant of [
    'abcd-1234-efgh-5678',
    'ABCD 1234 EFGH 5678',
    'ABCD1234EFGH5678',
    '  abcd1234EFGH5678  ',
  ]) {
    assert.strictEqual(normalizeRecoveryCode(variant), target, `varyasyon: ${variant}`);
  }
  // Karisan harf duzeltmesi: I/L -> 1, O -> 0.
  assert.strictEqual(normalizeRecoveryCode('IBCD-1234-EFGH-5678'), target.replace(/^A/, '1'));

  // Gecersizler.
  for (const bad of ['', 'ABC', 'ABCD-1234-EFGH', 'ABCD-1234-EFGH-567', '!!!!-1234-EFGH-5678']) {
    assert.strictEqual(normalizeRecoveryCode(bad), null, `gecersiz: ${bad}`);
  }

  assert.ok(recoveryCodesMatch(target, target));
  assert.ok(!recoveryCodesMatch(target, normalizeRecoveryCode('ZZZZ-1234-EFGH-5678')!));
  assert.ok(!recoveryCodesMatch(target, 'kisa'));

  // Iki kod ayni cikmamali (rastgelelik canli mi).
  assert.notStrictEqual(generateRecoveryCode(), generateRecoveryCode());

  console.log('✓ recovery.code self-check OK');
}
