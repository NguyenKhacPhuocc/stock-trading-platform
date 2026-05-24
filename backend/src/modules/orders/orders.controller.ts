import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { PreCheckOrderDto } from './dto/pre-check-order.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('pre-check')
  preCheck(
    @CurrentUser() user: { id: string },
    @Body() dto: PreCheckOrderDto,
  ) {
    return this.orders.preCheckOrder(user.id, dto);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(user.id, dto);
  }

  @Get()
  getMyOrders(@CurrentUser() user: { id: string }) {
    return this.orders.getUserOrders(user.id);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.orders.cancelOrder(user.id, id);
  }
}
