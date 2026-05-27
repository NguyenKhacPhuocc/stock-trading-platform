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

  @Get('cash-statement')
  getCashStatement(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.wallet.getCashStatement(
      user.id,
      tradingAccountId,
      from,
      to,
      limit,
      offset,
    );
  }

  @Get('stock-statement')
  getStockStatement(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.wallet.getStockStatement(
      user.id,
      tradingAccountId,
      from,
      to,
      limit,
      offset,
      symbol,
    );
  }

  @Get('sell-fills')
  getSellFills(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.wallet.getSellFills(
      user.id,
      tradingAccountId,
      from,
      to,
      limit,
      offset,
    );
  }

  @Get('account-trades')
  getAccountTrades(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.wallet.getAccountTrades(
      user.id,
      tradingAccountId,
      from,
      to,
      limit,
      offset,
      symbol,
    );
  }

  @Get('nav-history')
  getNavHistory(
    @CurrentUser() user: { id: string },
    @Query('tradingAccountId', ParseUUIDPipe) tradingAccountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.getNavHistory(
      user.id,
      tradingAccountId,
      from,
      to,
      limit,
    );
  }
}
