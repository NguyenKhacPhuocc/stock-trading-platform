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
