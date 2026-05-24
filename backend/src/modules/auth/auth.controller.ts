import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthTokensPayload } from './auth.types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenBodyDto } from './dto/refresh-token.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordConfirmDto } from './dto/forgot-password-confirm.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { ttlToMs } from './auth-token.util';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/errors/business.exception';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: AuthTokensPayload = await this.authService.login(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // Postman: dùng accessToken / refreshToken trong body; trình duyệt dùng cookie
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const plain =
      (typeof req.cookies?.refresh_token === 'string'
        ? req.cookies.refresh_token
        : undefined) ?? dto.refreshToken;
    if (!plain?.trim()) {
      throw new BusinessException(
        'AUTH_REFRESH_TOKEN_MISSING',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result: AuthTokensPayload = await this.authService.rotateRefreshPair(
      plain.trim(),
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('forgot-password/request')
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('forgot-password/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPasswordReset(@Body() dto: ForgotPasswordConfirmDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshTokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const plain =
      (typeof req.cookies?.refresh_token === 'string'
        ? req.cookies.refresh_token
        : undefined) ?? dto.refreshToken;
    await this.authService.revokeRefreshToken(plain);
    this.clearAuthCookies(res);
    return { message: 'Đăng xuất thành công' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.authService.getSessionForUser(user);
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
    };
    const accessTtl =
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      this.config.get<string>('JWT_EXPIRES_IN') ??
      '15m';
    const refreshTtl =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    res.cookie('access_token', accessToken, {
      ...base,
      maxAge: ttlToMs(accessTtl),
      path: '/',
    });
    // path '/' để browser gửi cookie khi gọi BFF /trade/api/gateway/auth/* (option 4a)
    res.cookie('refresh_token', refreshToken, {
      ...base,
      maxAge: ttlToMs(refreshTtl),
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
    res.clearCookie('access_token', { ...base, path: '/' });
    res.clearCookie('refresh_token', { ...base, path: '/' });
  }
}
