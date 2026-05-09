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
import { buildRealtimeEnvelope } from './realtime-envelope.util';

function normalizeWsSymbol(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s.length === 0 || s.length > 20) return null;
  if (!/^[A-Z0-9]+$/.test(s)) return null;
  return s;
}

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
    @MessageBody() data: { symbol?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const symbol = normalizeWsSymbol(data?.symbol);
    if (!symbol) return;
    void client.join(`room:orderbook:${symbol}`);
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

  emitRealtimeToRoom<TData>(input: {
    room: string;
    event: string;
    type: string;
    seq: number;
    data: TData;
  }) {
    const envelope = buildRealtimeEnvelope({
      type: input.type,
      seq: input.seq,
      data: input.data,
    });
    this.server.to(input.room).emit(input.event, envelope);
  }
}
