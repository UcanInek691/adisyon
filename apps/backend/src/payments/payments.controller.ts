import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { PaymentsService } from './payments.service';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import {
  recordPaymentSchema,
  reversePaymentSchema,
  type RecordPaymentDto,
  type ReversePaymentDto,
} from './dto/payments.schemas';

@Controller('orders/:orderId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @RequirePermissions(Permission.PaymentTake)
  record(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) dto: RecordPaymentDto,
  ) {
    return this.payments.recordPayment(user, orderId, dto);
  }

  @Get()
  @RequirePermissions(Permission.PaymentTake)
  list(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.listPayments(user, orderId);
  }

  @Post(':paymentId/reverse')
  @RequirePermissions(Permission.PaymentRefund)
  reverse(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Body(new ZodValidationPipe(reversePaymentSchema)) dto: ReversePaymentDto,
  ) {
    return this.payments.reversePayment(user, orderId, paymentId, dto);
  }
}
