import { Body, Controller, Get, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { FinanceService } from './finance.service';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  createIncomeSchema,
  type CreateExpenseCategoryDto,
  type CreateExpenseDto,
  type CreateIncomeDto,
} from './dto/finance.schemas';

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post('categories')
  @RequirePermissions(Permission.FinanceManage)
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createExpenseCategorySchema)) dto: CreateExpenseCategoryDto,
  ) {
    return this.finance.createCategory(user, dto);
  }

  @Get('categories')
  @RequirePermissions(Permission.FinanceManage)
  listCategories(@CurrentUser() user: AuthUser) {
    return this.finance.listCategories(user);
  }

  @Post('expenses')
  @RequirePermissions(Permission.FinanceManage)
  createExpense(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ) {
    return this.finance.createExpense(user, dto);
  }

  @Get('expenses')
  @RequirePermissions(Permission.FinanceManage)
  listExpenses(@CurrentUser() user: AuthUser) {
    return this.finance.listExpenses(user);
  }

  @Post('incomes')
  @RequirePermissions(Permission.FinanceManage)
  createIncome(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createIncomeSchema)) dto: CreateIncomeDto,
  ) {
    return this.finance.createIncome(user, dto);
  }

  @Get('incomes')
  @RequirePermissions(Permission.FinanceManage)
  listIncomes(@CurrentUser() user: AuthUser) {
    return this.finance.listIncomes(user);
  }
}
