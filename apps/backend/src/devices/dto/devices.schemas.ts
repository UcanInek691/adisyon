import { z } from 'zod';

export const registerDeviceSchema = z.object({
  name: z.string().min(1),
  fingerprintHash: z.string().min(1),
  platform: z.string().nullish(),
});
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;

export const trustDeviceSchema = z.object({ isTrusted: z.boolean() });
export type TrustDeviceDto = z.infer<typeof trustDeviceSchema>;
