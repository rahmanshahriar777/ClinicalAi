import { type LoginInput, loginSchema, mfaConfirmSchema, type MfaVerifyInput, mfaVerifySchema, type RefreshInput, refreshSchema, type RegisterPatientInput, registerPatientSchema } from '@app/shared';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { Client, type ClientInfo, CurrentUser, Public } from '../../common/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';

import { AuthService } from './auth.service';
import type { RequestUser } from './auth.types';

const logoutSchema = z.object({ refreshToken: z.string().optional() });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Password login (AUTH_MODE=local). Returns tokens or an MFA challenge.' })
  login(@Body(zodBody(loginSchema)) body: LoginInput, @Client() client: ClientInfo) {
    return this.auth.login(body, client);
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete an MFA challenge' })
  verifyMfa(@Body(zodBody(mfaVerifySchema)) body: MfaVerifyInput, @Client() client: ClientInfo) {
    return this.auth.verifyMfa(body.mfaToken, body.code, client);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body(zodBody(refreshSchema)) body: RefreshInput, @Client() client: ClientInfo) {
    return this.auth.refresh(body.refreshToken, client);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: RequestUser, @Body(zodBody(logoutSchema)) body: { refreshToken?: string }) {
    await this.auth.logout(user, body.refreshToken);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Patient self-registration (AUTH_MODE=local)' })
  register(@Body(zodBody(registerPatientSchema)) body: RegisterPatientInput, @Client() client: ClientInfo) {
    return this.auth.registerPatient(body, client);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current principal and effective permissions' })
  me(@CurrentUser() user: RequestUser) {
    const { sessionId: _s, ...rest } = user;
    return rest;
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin TOTP enrolment; returns the otpauth URL for an authenticator app' })
  setupMfa(@CurrentUser() user: RequestUser) {
    return this.auth.setupMfa(user);
  }

  @Post('mfa/confirm')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm TOTP enrolment with a code' })
  async confirmMfa(@CurrentUser() user: RequestUser, @Body(zodBody(mfaConfirmSchema)) body: { code: string }) {
    await this.auth.confirmMfa(user, body.code);
  }
}
