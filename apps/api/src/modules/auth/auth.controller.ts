import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Headers,
  Req,
  Res,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  clearRefreshCookie,
  hasCsrfHeader,
  parseExpiresInToSeconds,
  readCookie,
  REFRESH_COOKIE_NAME,
  resolveRefreshCookieSameSite,
  setRefreshCookie,
  type RefreshCookieSameSite,
} from '../../common/auth/refresh-cookie';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { AuthService, type AuthResponse, type AuthTokens } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

type PublicAuthResponse = Omit<AuthResponse, 'refreshToken'>;
type PublicAuthTokens = Omit<AuthTokens, 'refreshToken'>;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.auth.register(dto);
    this.attachRefreshCookie(res, result.refreshToken);
    return this.toPublicAuth(result);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.auth.login(dto);
    this.attachRefreshCookie(res, result.refreshToken);
    return this.toPublicAuth(result);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthResponse> {
    const result = await this.auth.googleAuth(dto);
    this.attachRefreshCookie(res, result.refreshToken);
    return this.toPublicAuth(result);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: RawBodyRequest<Request>,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<PublicAuthTokens> {
    const cookieToken = readCookie(req, REFRESH_COOKIE_NAME);
    const bodyToken = dto.refreshToken;
    const token = cookieToken ?? bodyToken;
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (cookieToken && !hasCsrfHeader(req)) {
      throw new UnauthorizedException('Missing CSRF header');
    }

    const result = await this.auth.refresh(token, { ip, userAgent });
    this.attachRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: RawBodyRequest<Request>,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieToken = readCookie(req, REFRESH_COOKIE_NAME);
    const token = cookieToken ?? dto.refreshToken;
    if (cookieToken && !hasCsrfHeader(req)) {
      throw new UnauthorizedException('Missing CSRF header');
    }
    if (token) {
      await this.auth.logout(token);
    }
    this.clearCookie(res);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link was sent.' };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Ip() ip: string): Promise<void> {
    await this.auth.verifyEmail(dto.token, { ip });
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('resend-verification')
  async resendVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ): Promise<{ message: string }> {
    return this.auth.resendVerification(user.id, { ip });
  }

  @ApiBearerAuth()
  @RequireEmailVerified()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('organizations/:organizationId/switch')
  async switchOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuthTokens> {
    const result = await this.auth.switchOrganization(user.id, organizationId);
    this.attachRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private toPublicAuth(result: AuthResponse): PublicAuthResponse {
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  private attachRefreshCookie(res: Response, refreshToken: string): void {
    const maxAge = parseExpiresInToSeconds(this.config.get<string>('jwt.refreshExpiresIn'));
    const sameSite = this.refreshCookieSameSite();
    setRefreshCookie(res, refreshToken, maxAge, this.isSecureCookie(sameSite), sameSite);
  }

  private clearCookie(res: Response): void {
    const sameSite = this.refreshCookieSameSite();
    clearRefreshCookie(res, this.isSecureCookie(sameSite), sameSite);
  }

  private refreshCookieSameSite(): RefreshCookieSameSite {
    const env = this.config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development';
    return resolveRefreshCookieSameSite(this.config.get<string>('refreshCookie.sameSite'), env);
  }

  private isSecureCookie(sameSite: RefreshCookieSameSite = 'lax'): boolean {
    const env = this.config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development';
    return env === 'production' || env === 'staging' || sameSite === 'none';
  }
}
