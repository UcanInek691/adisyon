import { Body, Controller, Get, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { CashService } from './cash.service';
import {
  openSessionSchema,
  closeSessionSchema,
  createCashTransactionSchema,
  type OpenSessionDto,
  type CloseSessionDto,
  type CreateCashTransactionDto,
} from './dto/cash.schemas';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('sessions/open')
  @RequirePermissions(Permission.CashManage)
  openSession(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(openSessionSchema)) dto: OpenSessionDto,
  ) {
    return this.cashService.openSession(user, dto);
  }

  @Post('sessions/close')
  @RequirePermissions(Permission.CashManage)
  closeSession(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(closeSessionSchema)) dto: CloseSessionDto,
  ) {
    return this.cashService.closeSession(user, dto);
  }

  @Get('sessions/active')
  @RequirePermissions(Permission.CashManage)
  getActiveSession(@CurrentUser() user: AuthUser) {
    return this.cashService.getActiveSession(user);
  }

  @Get('status')
  getStatus(@CurrentUser() user: AuthUser) {
    return this.cashService.getStatus(user);
  }

  @Post('transactions')
  @RequirePermissions(Permission.CashManage)
  createTransaction(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCashTransactionSchema)) dto: CreateCashTransactionDto,
  ) {
    return this.cashService.createTransaction(user, dto);
  }
}
