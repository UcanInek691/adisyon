/**
 * "15m" / "12h" / "30d" / "45s" gibi sureleri milisaniyeye cevirir.
 * Session.expiresAt hesabinda kullanilir (JWT'nin kendi expiresIn'i ayridir).
 */
function unitMs(unit: string): number {
  switch (unit) {
    case 's':
      return 1000;
    case 'm':
      return 60_000;
    case 'h':
      return 3_600_000;
    case 'd':
      return 86_400_000;
    default:
      throw new Error(`Gecersiz sure birimi: "${unit}".`);
  }
}

export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error(`Gecersiz sure formati: "${input}" (ornek: 15m, 12h, 30d).`);
  }
  return Number(match[1]) * unitMs(match[2]);
}
