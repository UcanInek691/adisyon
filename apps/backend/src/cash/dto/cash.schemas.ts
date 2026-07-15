import { z } from 'zod';
import { CashTxnType, PaymentMethod } from '@ado/shared';

export const openSessionSchema = z.object({
  openingFloat: z.number().int().nonnegative(), // kurus
});
export type OpenSessionDto = z.infer<typeof openSessionSchema>;

export const closeSessionSchema = z.object({
  countedAmount: z.number().int().nonnegative(), // kurus
});
export type CloseSessionDto = z.infer<typeof closeSessionSchema>;

export const createCashTransactionSchema = z.object({
  type: z.nativeEnum(CashTxnType),
  amount: z.number().int(), // kurus (girdi/cikti durumuna gore +/-)
  method: z.nativeEnum(PaymentMethod),
  note: z.string().nullish(),
});
export type CreateCashTransactionDto = z.infer<typeof createCashTransactionSchema>;
