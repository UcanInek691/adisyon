import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { InventoryService } from './inventory.service';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseSchema,
  createStockMovementSchema,
  type CreateSupplierDto,
  type UpdateSupplierDto,
  type CreatePurchaseDto,
  type CreateStockMovementDto,
} from './dto/inventory.schemas';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('suppliers')
  @RequirePermissions(Permission.FinanceManage)
  createSupplier(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto,
  ) {
    return this.inventoryService.createSupplier(user, dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions(Permission.FinanceManage)
  updateSupplier(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierDto,
  ) {
    return this.inventoryService.updateSupplier(user, id, dto);
  }

  @Delete('suppliers/:id')
  @RequirePermissions(Permission.FinanceManage)
  removeSupplier(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventoryService.deleteSupplier(user, id);
  }

  @Get('suppliers')
  @RequirePermissions(Permission.FinanceManage)
  listSuppliers(@CurrentUser() user: AuthUser) {
    return this.inventoryService.listSuppliers(user);
  }

  @Post('purchases')
  @RequirePermissions(Permission.FinanceManage)
  createPurchase(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPurchaseSchema)) dto: CreatePurchaseDto,
  ) {
    return this.inventoryService.createPurchase(user, dto);
  }

  @Post('movements')
  @RequirePermissions(Permission.FinanceManage)
  createMovement(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createStockMovementSchema)) dto: CreateStockMovementDto,
  ) {
    return this.inventoryService.createStockMovement(user, dto);
  }

  @Get('movements/:productId')
  @RequirePermissions(Permission.FinanceManage)
  getProductMovements(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.inventoryService.getProductMovements(user, productId);
  }
}
