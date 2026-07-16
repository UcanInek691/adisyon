import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { CustomerService } from './customer.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  addDebtSchema,
  payDebtSchema,
  type CreateCustomerDto,
  type UpdateCustomerDto,
  type AddDebtDto,
  type PayDebtDto,
} from './dto/customer.schemas';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @RequirePermissions(Permission.DebtManage)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto,
  ) {
    return this.customerService.createCustomer(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DebtManage)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customerService.updateCustomer(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DebtManage)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customerService.deleteCustomer(user, id);
  }

  @Get()
  @RequirePermissions(Permission.DebtManage)
  list(@CurrentUser() user: AuthUser) {
    return this.customerService.listCustomers(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.DebtManage)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customerService.getCustomer(user, id);
  }

  @Post(':id/debt')
  @RequirePermissions(Permission.DebtManage)
  addDebt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addDebtSchema)) dto: AddDebtDto,
  ) {
    return this.customerService.addDebt(user, id, dto);
  }

  @Post(':id/payment')
  @RequirePermissions(Permission.DebtManage)
  payDebt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payDebtSchema)) dto: PayDebtDto,
  ) {
    return this.customerService.payDebt(user, id, dto);
  }
}
