import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
}
