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
