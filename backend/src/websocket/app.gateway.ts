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
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { buildRealtimeEnvelope } from './realtime-envelope.util';
import { MarketRealtimePublisherService } from '../modules/matching/market-realtime-publisher.service';
import {
  WS_EVT,
  WS_ROOM_IDX,
  isAllowedWsExchange,
  wsRoomExchange,
  wsRoomInstrument,
} from './ws-realtime.constants';

function normalizeWsSymbol(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s.length === 0 || s.length > 20) return null;
  if (!/^[A-Z0-9]+$/.test(s)) return null;
  return s;
}

function normalizeWsExchangeStrict(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (!isAllowedWsExchange(s)) return null;
  return s;
}

/** Một hoặc nhiều mã — client gửi `{ EX: 'HOSE' }` hoặc `{ EX: ['HOSE','HNX'] }`. */
function normalizeExchangeList(raw: unknown): string[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const x of list) {
    const ex = typeof x === 'string' ? normalizeWsExchangeStrict(x) : null;
    if (ex) out.push(ex);
  }
  return [...new Set(out)];
}

/** Một hoặc nhiều symbol — `{ SB: 'VCB' }` hoặc `{ SB: ['VCB','HPG'] }`. */
function normalizeSymbolList(raw: unknown): string[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const x of list) {
    const sb = typeof x === 'string' ? normalizeWsSymbol(x) : null;
    if (sb) out.push(sb);
  }
  return [...new Set(out)];
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

  constructor(
    @Inject(forwardRef(() => MarketRealtimePublisherService))
    private readonly marketPublisher: MarketRealtimePublisherService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Bắt buộc `SB` — chỉ join room một mã.
   * Snapshot bảng giá từ REST; chỉ có thêm tin TOP sổ (OB) từ book in-memory nếu thay đổi vs lần trước.
   */
  @SubscribeMessage('subscribe:i')
  handleSubscribeInstrument(
    @MessageBody() data: { SB?: string | string[] } | undefined,
    @ConnectedSocket() client: Socket,
  ) {
    for (const sb of normalizeSymbolList(data?.SB)) {
      void client.join(wsRoomInstrument(sb));
      void this.marketPublisher
        .publishSubscribeOrderbookBySymbol(sb)
        .catch((e: unknown) => {
          this.logger.warn(`publishSubscribeOrderbookBySymbol: ${String(e)}`);
        });
    }
  }

  @SubscribeMessage('unsubscribe:i')
  handleUnsubscribeInstrument(
    @MessageBody() data: { SB?: string | string[] } | undefined,
    @ConnectedSocket() client: Socket,
  ) {
    for (const sb of normalizeSymbolList(data?.SB)) {
      void client.leave(wsRoomInstrument(sb));
    }
  }

  /** Chỉ join room sàn để nhận tick các mã thuộc sàn — không bootstrap snapshot qua WS. */
  @SubscribeMessage('subscribe:e')
  handleSubscribeExchange(
    @MessageBody() data: { EX?: string | string[] },
    @ConnectedSocket() client: Socket,
  ) {
    for (const ex of normalizeExchangeList(data?.EX)) {
      void client.join(wsRoomExchange(ex));
    }
  }

  @SubscribeMessage('unsubscribe:e')
  handleUnsubscribeExchange(
    @MessageBody() data: { EX?: string | string[] },
    @ConnectedSocket() client: Socket,
  ) {
    for (const ex of normalizeExchangeList(data?.EX)) {
      void client.leave(wsRoomExchange(ex));
    }
  }

  @SubscribeMessage('subscribe:idx')
  handleSubscribeIndex(@ConnectedSocket() client: Socket) {
    void client.join(WS_ROOM_IDX);
  }

  @SubscribeMessage('unsubscribe:idx')
  handleUnsubscribeIndex(@ConnectedSocket() client: Socket) {
    void client.leave(WS_ROOM_IDX);
  }

  /** Tick TOP sổ / khớp — tới `room:i:<SB>` và `room:e:<EX>` (không có payload MB). */
  emitInstrumentTick(
    envelope: {
      ty: string;
      q: number;
      SB: string;
      ch: Record<string, unknown>;
    },
    stockExchange?: string | null,
  ) {
    const sym = envelope.SB.toUpperCase();
    void this.server
      .to(wsRoomInstrument(sym))
      .emit(WS_EVT.INSTRUMENT, envelope);
    const ex =
      stockExchange != null && stockExchange !== ''
        ? normalizeWsExchangeStrict(stockExchange)
        : null;
    if (ex) {
      void this.server.to(wsRoomExchange(ex)).emit(WS_EVT.INSTRUMENT, envelope);
    }
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
    void this.server.to(input.room).emit(input.event, envelope);
  }

  emitOrderMatched(userId: string, payload: unknown) {
    void this.server.to(`user:${userId}`).emit('order:matched', payload);
  }
}
