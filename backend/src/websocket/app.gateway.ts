import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const wsCorsOrigins = process.env.FRONTEND_URL?.split(',')
  .map((s) => s.trim())
  .filter(Boolean) ?? ['http://localhost:3000', 'http://localhost:3001'];

@WebSocketGateway({
  cors: {
    origin: wsCorsOrigins,
    credentials: true,
  },
  namespace: '/',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Subscribe nhận cập nhật bảng giá tổng
  @SubscribeMessage('subscribe:price')
  handleSubscribePrice(@ConnectedSocket() client: Socket) {
    void client.join('room:price');
  }

  // Subscribe order book theo mã cụ thể
  @SubscribeMessage('subscribe:orderbook')
  handleSubscribeOrderbook(
    @MessageBody() data: { symbol: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`room:orderbook:${data.symbol}`);
  }

  // Emit cập nhật giá đến tất cả subscriber (gọi từ MarketService)
  emitPriceUpdate(payload: unknown) {
    this.server.to('room:price').emit('price:update', payload);
  }

  // Emit cập nhật order book cho một mã
  emitOrderbookUpdate(symbol: string, payload: unknown) {
    this.server
      .to(`room:orderbook:${symbol}`)
      .emit('orderbook:update', payload);
  }

  // Emit thông báo lệnh đã khớp đến user cụ thể
  emitOrderMatched(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('order:matched', payload);
  }
}
