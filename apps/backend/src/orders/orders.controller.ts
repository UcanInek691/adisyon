import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { OrdersService } from './orders.service';
import {
  openOrderSchema,
  addItemSchema,
  updateItemSchema,
  voidItemSchema,
  cancelOrderSchema,
  orderQuerySchema,
  type OpenOrderDto,
  type AddItemDto,
  type UpdateItemDto,
  type VoidItemDto,
  type CancelOrderDto,
  type OrderQueryDto,
} from './dto/orders.schemas';

/**
 * Adisyon ac / kalem ekle-duzenle: order.create / order.item.edit (Waiter'da var).
 * Void / iptal: order.cancel (Owner).
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @RequirePermissions(Permission.OrderCreate)
  open(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(openOrderSchema)) dto: OpenOrderDto,
  ) {
    return this.orders.openOrder(user, dto);
  }

  @Get()
  @RequirePermissions(Permission.OrderCreate)
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(orderQuerySchema)) query: OrderQueryDto,
  ) {
    return this.orders.listOrders(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.OrderCreate)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOrder(user, id);
  }

  @Post(':id/items')
  @RequirePermissions(Permission.OrderItemEdit)
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addItemSchema)) dto: AddItemDto,
  ) {
    return this.orders.addItem(user, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(Permission.OrderItemEdit)
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(updateItemSchema)) dto: UpdateItemDto,
  ) {
    return this.orders.updateItem(user, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(Permission.OrderItemEdit)
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.orders.removeItem(user, id, itemId);
  }

  @Post(':id/items/:itemId/void')
  @RequirePermissions(Permission.OrderCancel)
  voidItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(voidItemSchema)) dto: VoidItemDto,
  ) {
    return this.orders.voidItem(user, id, itemId, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.OrderCancel)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) dto: CancelOrderDto,
  ) {
    return this.orders.cancelOrder(user, id, dto);
  }
}
