import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: { id: string }) {
    return this.wallet.getWallet(user.id);
  }

  @Get('positions')
  getPositions(@CurrentUser() user: { id: string }) {
    return this.wallet.getPositions(user.id);
  }
}
