import { z } from 'zod';
import { StockMovementType } from '@ado/shared';

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  note: z.string().nullish(),
});
export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

export const createPurchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(), // milis
  unitCost: z.number().int().nonnegative(), // kurus
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1),
  invoiceNo: z.string().nullish(),
  total: z.number().int().nonnegative(), // kurus
  purchasedAt: z
    .string()
    .datetime()
    .optional()
    .default(() => new Date().toISOString()),
  items: z.array(createPurchaseItemSchema).min(1),
});
export type CreatePurchaseDto = z.infer<typeof createPurchaseSchema>;

export const createStockMovementSchema = z.object({
  productId: z.string().min(1),
  type: z.nativeEnum(StockMovementType),
  quantity: z.number().int(), // milis (+/-)
  note: z.string().nullish(),
});
export type CreateStockMovementDto = z.infer<typeof createStockMovementSchema>;
