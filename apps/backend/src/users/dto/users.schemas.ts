import { z } from 'zod';

/** Yeni kullanici: owner sifreyle, garson PIN ile girer. */
export const createUserSchema = z
  .object({
    username: z.string().min(3),
    displayName: z.string().min(1),
    role: z.enum(['owner', 'waiter']),
    password: z.string().min(6).optional(),
    pin: z
      .string()
      .regex(/^\d{4,6}$/, 'PIN 4-6 rakam olmali.')
      .optional(),
  })
  .refine((d) => (d.role === 'owner' ? !!d.password : !!d.pin), {
    message: 'Yönetici için şifre, garson için PIN zorunludur.',
  });
export type CreateUserDto = z.infer<typeof createUserSchema>;

/** Guncelleme: ad, sifre/PIN sifirlama, aktif/pasif. */
export const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN 4-6 rakam olmali.')
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
