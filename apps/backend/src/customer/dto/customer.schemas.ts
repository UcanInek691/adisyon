import { z } from 'zod';
import { PaymentMethod } from '@ado/shared';

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  taxNo: z.string().nullish(),
  nationalId: z.string().nullish(),
  note: z.string().nullish(),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const addDebtSchema = z.object({
  amount: z.number().int().positive(), // kurus
  note: z.string().nullish(),
});
export type AddDebtDto = z.infer<typeof addDebtSchema>;

export const payDebtSchema = z.object({
  amount: z.number().int().positive(), // kurus
  method: z.nativeEnum(PaymentMethod),
  note: z.string().nullish(),
  allowOverpay: z.boolean().optional(), // borctan fazla tahsilat -> kullanici onayi ile
});
export type PayDebtDto = z.infer<typeof payDebtSchema>;
