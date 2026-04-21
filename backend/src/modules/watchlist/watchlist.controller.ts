import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateWatchlistDto {
  @IsString() name: string;
}
class AddItemDto {
  @IsString() stockId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('watchlists')
export class WatchlistController {
  constructor(private watchlist: WatchlistService) {}

  @Get()
  getAll(@CurrentUser() user: { id: string }) {
    return this.watchlist.getWatchlists(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateWatchlistDto) {
    return this.watchlist.createWatchlist(user.id, dto.name);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AddItemDto,
  ) {
    return this.watchlist.addItem(id, dto.stockId, user.id);
  }

  @Delete(':id/items/:stockId')
  removeItem(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('stockId') stockId: string,
  ) {
    return this.watchlist.removeItem(id, stockId, user.id);
  }

  @Delete(':id')
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.watchlist.deleteWatchlist(id, user.id);
  }
}
