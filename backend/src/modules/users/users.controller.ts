import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupTradingPinDto } from './dto/setup-trading-pin.dto';
import { ChangeTradingPinDto } from './dto/change-trading-pin.dto';
import { AuditHistoryQueryDto } from './dto/audit-history-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me/accounts')
  listMyTradingAccounts(@CurrentUser() user: { id: string }) {
    return this.users.listMyTradingAccounts(user.id);
  }

  @Get('me')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(user.id, dto);
  }

  @Patch('me/trading-pin')
  setupTradingPin(
    @CurrentUser() user: { id: string },
    @Body() dto: SetupTradingPinDto,
  ) {
    return this.users.setupTradingPin(user.id, dto);
  }

  @Patch('me/trading-pin/change')
  changeTradingPin(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangeTradingPinDto,
  ) {
    return this.users.changeTradingPin(user.id, dto);
  }

  @Get('me/login-history')
  loginHistory(
    @CurrentUser() user: { id: string },
    @Query() query: AuditHistoryQueryDto,
  ) {
    return this.users.listLoginHistory(
      user.id,
      query.from,
      query.to,
      query.limit,
      query.offset,
    );
  }

  @Get('me/profile-change-history')
  profileChangeHistory(
    @CurrentUser() user: { id: string },
    @Query() query: AuditHistoryQueryDto,
  ) {
    return this.users.listProfileChangeHistory(
      user.id,
      query.from,
      query.to,
      query.limit,
      query.offset,
    );
  }
}
