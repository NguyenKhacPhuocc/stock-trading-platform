import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  getWallet(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
  ) {
    return this.wallet.getWallet(user.id, tradingAccountId);
  }

  @Get('positions')
  getPositions(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
  ) {
    return this.wallet.getPositions(user.id, tradingAccountId);
  }

  @Get('overview')
  getOverview(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
  ) {
    return this.wallet.getPortfolioOverview(user.id, tradingAccountId);
  }
}
