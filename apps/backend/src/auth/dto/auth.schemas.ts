import { z } from 'zod';

/** Owner girisi: kullanici adi + sifre. */
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

/** Waiter girisi: PIN + (opsiyonel) cihaz kimligi/adi. OFFLINE_DESIGN.md §12. */
export const loginPinSchema = z.object({
  pin: z.string().min(3),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});
export type LoginPinDto = z.infer<typeof loginPinSchema>;

/** Access token yenileme. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

/** Ilk kurulum: sistemde hic kullanici yokken owner (+opsiyonel garson) olustur. */
export const setupSchema = z.object({
  ownerUsername: z.string().min(3),
  ownerPassword: z.string().min(6),
  ownerDisplayName: z.string().min(1).optional(),
  waiterUsername: z.string().min(3).optional(),
  waiterPin: z.string().min(3).optional(),
});
export type SetupDto = z.infer<typeof setupSchema>;

/** Owner sifre onayi (gun sonu vb.). */
// Kurtarma kodu ile sifre sifirlama. Kod bicimi serviste normalize edilir;
// burada yalnizca makul uzunluk siniri (kaba kuvvet/DoS icin).
export const recoveryResetSchema = z.object({
  username: z.string().min(1).max(64),
  code: z.string().min(16).max(32),
  newPassword: z.string().min(6).max(128),
});
export type RecoveryResetDto = z.infer<typeof recoveryResetSchema>;

export const recoveryToggleSchema = z.object({ enabled: z.boolean() });
export type RecoveryToggleDto = z.infer<typeof recoveryToggleSchema>;

export const verifyOwnerSchema = z.object({
  password: z.string().min(1),
});
export type VerifyOwnerDto = z.infer<typeof verifyOwnerSchema>;
