import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import {
  loginSchema,
  loginPinSchema,
  refreshSchema,
  setupSchema,
  type LoginDto,
  type LoginPinDto,
  type RefreshDto,
  type SetupDto,
} from './dto/auth.schemas';
import { AuthService, type RequestMeta } from './auth.service';

function metaOf(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  return {
    ...(req.ip ? { ip: req.ip } : {}),
    ...(typeof ua === 'string' ? { userAgent: ua } : {}),
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('setup-status')
  setupStatus(): Promise<unknown> {
    return this.auth.setupStatus();
  }

  @Public()
  @Post('setup')
  setup(@Body(new ZodValidationPipe(setupSchema)) dto: SetupDto): Promise<unknown> {
    return this.auth.setup(dto);
  }

  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.auth.login(dto, metaOf(req));
  }

  @Public()
  @Post('login-pin')
  loginPin(
    @Body(new ZodValidationPipe(loginPinSchema)) dto: LoginPinDto,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.auth.loginPin(dto, metaOf(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto): Promise<unknown> {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.auth.logout(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.auth.me(user);
  }
}
