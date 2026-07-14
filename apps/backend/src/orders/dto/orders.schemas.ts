import { z } from 'zod';
import { OrderStatus } from '@ado/shared';

/** Query string 'true'/'false' -> boolean. */
const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

// clientOpId: offline idempotency anahtari (ULID). Istege bagli.
const clientOpId = z.string().min(1).optional();

// --- Adisyon ac ---
export const openOrderSchema = z.object({
  tableId: z.string().nullish(),
  guestCount: z.number().int().positive().optional(),
  note: z.string().nullish(),
  clientOpId,
});
export type OpenOrderDto = z.infer<typeof openOrderSchema>;

// --- Kalem ekle (fiyat/vergi/ad SUNUCUDA snapshot alinir; istemci gondermez) ---
export const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(), // milis (x1000)
  note: z.string().nullish(),
  clientOpId,
});
export type AddItemDto = z.infer<typeof addItemSchema>;

// --- Kalem miktar guncelle ---
export const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});
export type UpdateItemDto = z.infer<typeof updateItemSchema>;

// --- Kalem void / adisyon iptal (gerekce) ---
export const voidItemSchema = z.object({
  reason: z.string().nullish(),
});
export type VoidItemDto = z.infer<typeof voidItemSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().nullish(),
});
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;

// --- Sorgu ---
export const orderQuerySchema = z.object({
  tableId: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  open: boolQuery, // true -> yalniz acik adisyonlar
});
export type OrderQueryDto = z.infer<typeof orderQuerySchema>;
