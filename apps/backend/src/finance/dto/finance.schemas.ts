import { z } from 'zod';

export const createExpenseCategorySchema = z.object({ name: z.string().min(1) });
export type CreateExpenseCategoryDto = z.infer<typeof createExpenseCategorySchema>;

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().positive(), // kurus
  description: z.string().nullish(),
  spentAt: z.string().datetime().optional(),
  affectsCash: z.boolean().optional(), // vars. true -> acik kasaya gider hareketi
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const createIncomeSchema = z.object({
  category: z.string().nullish(),
  amount: z.number().int().positive(),
  description: z.string().nullish(),
  receivedAt: z.string().datetime().optional(),
  affectsCash: z.boolean().optional(),
});
export type CreateIncomeDto = z.infer<typeof createIncomeSchema>;
