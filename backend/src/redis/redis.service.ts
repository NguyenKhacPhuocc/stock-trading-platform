import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const database = this.config.get<number>('REDIS_DATABASE', 0);

    this.client = createClient({
      socket: {
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      },
      password: this.config.get('REDIS_PASSWORD'),
      database,
    }) as RedisClientType;

    this.client.on('error', (err) => this.logger.error('Redis error', err));
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keysByPrefix(prefix: string): Promise<string[]> {
    return this.client.keys(`${prefix}*`);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const keys = await this.keysByPrefix(prefix);
    if (keys.length === 0) return 0;
    return this.client.del(keys);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async hSet(key: string, fieldValues: Record<string, string | number>): Promise<void> {
    await this.client.hSet(key, fieldValues);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hGetAll(key);
  }

  async hDel(key: string, fields: string[]): Promise<void> {
    if (fields.length > 0) {
      await this.client.hDel(key, fields);
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  // ─── Redis Streams (WAL) ──────────────────────────────────────────────────

  /** Append một event vào stream, trả về stream ID (e.g. "1234567890-0"). */
  async xAdd(key: string, fields: Record<string, string>): Promise<string> {
    return this.client.xAdd(key, '*', fields);
  }

  /** Đọc events trong khoảng [start, end] (inclusive). Dùng '-' và '+' cho full range. */
  async xRange(
    key: string,
    start: string,
    end: string,
  ): Promise<Array<{ id: string; message: Record<string, string> }>> {
    return this.client.xRange(key, start, end);
  }

  async xLen(key: string): Promise<number> {
    return this.client.xLen(key);
  }

  /** Giữ lại maxLen event gần nhất, xóa phần cũ hơn. */
  async xTrim(key: string, maxLen: number): Promise<void> {
    await this.client.xTrim(key, 'MAXLEN', maxLen);
  }

  // Trả về subscriber client riêng (subscribe cần connection riêng)
  createSubscriberClient(): RedisClientType {
    const database = this.config.get<number>('REDIS_DATABASE', 0);

    return createClient({
      socket: {
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      },
      password: this.config.get('REDIS_PASSWORD'),
      database,
    }) as RedisClientType;
  }
}
