import assert from 'node:assert';
import { createPublicKey, generateKeyPairSync, sign, verify as verifySignature } from 'node:crypto';

// Yillik lisans anahtari: imzali, cevrimdisi dogrulanabilir tek metin.
//
//   ADO1.<base64url(payload JSON)>.<base64url(ed25519 imza)>
//
// Payload alanlari:
//   { c: musteri adi, p: plan, exp: 'YYYY-MM-DD', g: gun (ek sure), f: {flag} }
//
// Neden Ed25519: node stdlib'de var (bagimlilik yok), imza 64 bayt, anahtar
// dogrulama saniyenin altinda. Ozel anahtar SADECE satici tarafinda; kurulumdaki
// makinede yalnizca acik anahtar bulunur -> kasadaki dosyalardan anahtar
// uretilemez.
//
// ponytail: acik anahtar env ile gecilebilir; sabit gomulu deger uretim
// anahtariyla degistirilir. Anahtar rotasyonu gerekirse ACIK ANAHTAR LISTESI'ne
// cevrilir (dizi + ilk tutan kazanir).

const ENV_KEY = 'ADO_LICENSE_PUBLIC_KEY';

// Yer tutucu: uretim oncesi satici acik anahtari ile degistirilecek (base64,
// SPKI DER). Bos birakilirsa hicbir anahtar dogrulanamaz -> lisans zorunlu
// tutulamaz, sistem serbest calisir (guvenli varsayilan: kimseyi kilitlemez).
const EMBEDDED_PUBLIC_KEY_B64 = '';

export interface LicensePayload {
  /** customer — musteri/isletme adi */
  c: string;
  /** plan — 'yearly' vb. */
  p?: string;
  /** expires — 'YYYY-MM-DD' (dahil degil: bu gunun 00:00'inda biter) */
  exp: string;
  /** grace — bitisten sonra kac gun uyarili calismaya izin verilir */
  g?: number;
  /** features — feature-flag haritasi */
  f?: Record<string, boolean>;
}

function publicKeyB64(): string {
  return (process.env[ENV_KEY] ?? EMBEDDED_PUBLIC_KEY_B64).trim();
}

/** Acik anahtar tanimli mi. Yoksa lisans dogrulama devre disidir. */
export function hasPublicKey(): boolean {
  return publicKeyB64() !== '';
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Anahtari cozer ve imzayi dogrular. Gecersizse null (asla exception ile
 * cagirani bozmaz — lisans yolu uygulamayi dusurmemeli).
 */
export function parseLicenseKey(key: string): LicensePayload | null {
  const [tag, payloadPart, sigPart] = key.trim().split('.');
  if (tag !== 'ADO1' || !payloadPart || !sigPart) return null;
  const pub = publicKeyB64();
  if (!pub) return null;

  try {
    const payloadRaw = b64urlDecode(payloadPart);
    const sig = b64urlDecode(sigPart);
    const publicKey = createPublicKey({
      key: Buffer.from(pub, 'base64'),
      format: 'der',
      type: 'spki',
    });
    // Ed25519: algoritma parametresi null olmali.
    if (!verifySignature(null, payloadRaw, publicKey, sig)) return null;

    const payload = JSON.parse(payloadRaw.toString('utf8')) as LicensePayload;
    if (typeof payload.c !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.exp ?? '')) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** exp (YEREL gun basi) + grace gun -> bitis anlari. */
export function licenseDates(payload: LicensePayload): { validUntil: Date; graceUntil: Date } {
  const [y = 0, m = 1, d = 1] = payload.exp.split('-').map(Number);
  const validUntil = new Date(y, m - 1, d, 0, 0, 0, 0);
  const graceUntil = new Date(validUntil);
  graceUntil.setDate(graceUntil.getDate() + Math.max(0, payload.g ?? 0));
  return { validUntil, graceUntil };
}

// --- self-check: `ts-node src/license/license.keys.ts` ---
if (require.main === module) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  process.env[ENV_KEY] = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

  const b64url = (b: Buffer) => b.toString('base64url');
  const makeKey = (payload: LicensePayload, signWith = privateKey) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return `ADO1.${b64url(raw)}.${b64url(sign(null, raw, signWith))}`;
  };
  const good: LicensePayload = { c: 'Test Lokanta', p: 'yearly', exp: '2030-01-01', g: 7 };

  assert.ok(hasPublicKey(), 'env acik anahtari okunmali');
  assert.deepStrictEqual(parseLicenseKey(makeKey(good)), good);

  // Imza baska anahtarla atilirsa REDDEDILMELI (lisans kalpazanligi).
  const other = generateKeyPairSync('ed25519').privateKey;
  assert.strictEqual(parseLicenseKey(makeKey(good, other)), null, 'yabanci imza kabul edilmemeli');

  // Payload kurcalanirsa imza tutmaz.
  const parts = makeKey(good).split('.');
  const tampered = Buffer.from(JSON.stringify({ ...good, exp: '2099-01-01' })).toString(
    'base64url',
  );
  assert.strictEqual(
    parseLicenseKey(`ADO1.${tampered}.${parts[2]}`),
    null,
    'kurcalama yakalanmali',
  );

  // Bicim hatalari sessizce null doner (exception ile uygulamayi dusurmez).
  for (const bad of ['', 'ADO1.x', 'ADO2.a.b', 'saçmasapan', 'ADO1...']) {
    assert.strictEqual(parseLicenseKey(bad), null, `gecersiz bicim: ${bad}`);
  }

  // Tarihler YEREL gun basi + grace gun.
  const dates = licenseDates(good);
  assert.strictEqual(dates.validUntil.getFullYear(), 2030);
  assert.strictEqual(dates.validUntil.getMonth(), 0);
  assert.strictEqual(dates.validUntil.getDate(), 1);
  assert.strictEqual(dates.graceUntil.getDate(), 8);
  // grace yoksa graceUntil = validUntil.
  const noGrace = licenseDates({ c: 'x', exp: '2030-01-01' });
  assert.strictEqual(noGrace.graceUntil.getTime(), noGrace.validUntil.getTime());

  // Acik anahtar yoksa hicbir sey dogrulanamaz -> lisans zorlanamaz.
  process.env[ENV_KEY] = '';
  assert.strictEqual(hasPublicKey(), false);
  assert.strictEqual(parseLicenseKey(makeKey(good)), null);

  console.log('✓ license.keys self-check OK');
}
