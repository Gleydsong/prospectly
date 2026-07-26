import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { AuthService } from '../auth/auth.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { CreateDataRequestDto } from './dto/create-data-request.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Patch('me/email')
  changeEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeEmailDto,
    @Ip() ip: string,
  ) {
    return this.auth.changeEmail(
      user.id,
      { newEmail: dto.newEmail, currentPassword: dto.currentPassword },
      { ip },
    );
  }

  @RequireEmailVerified()
  @Post('me/data-requests')
  createDataRequest(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDataRequestDto) {
    return this.users.createDataSubjectRequest(user.id, dto.type, dto.notes);
  }
}
