import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { MatchingOrchestratorService } from './matching-orchestrator.service';

/**
 * Hàng đợi BullMQ (bền vững hơn list Redis + vòng lặp): worker gọi orchestrator,
 * vẫn chuỗi hóa theo mã qua tails trong MatchingOrchestratorService.
 */
@Injectable()
export class MatchingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingQueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly orchestrator: MatchingOrchestratorService,
  ) {}

  onModuleInit(): void {
    const connection = new IORedis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DATABASE', 0),
      maxRetriesPerRequest: null,
    });
    this.connection = connection;

    const queueName = this.config.get<string>(
      'MATCHING_QUEUE_NAME',
      'matching-jobs',
    );

    this.queue = new Queue(queueName, { connection });

    this.worker = new Worker(
      queueName,
      async (job) => {
        if (job.name === 'accepted') {
          const { orderId, stockId } = job.data as {
            orderId: string;
            stockId: string;
          };
          await this.orchestrator.enqueueAccepted(orderId, stockId);
        } else if (job.name === 'cancelled') {
          const { orderId, stockId, symbol } = job.data as {
            orderId: string;
            stockId: string;
            symbol: string;
          };
          await this.orchestrator.enqueueCancelled(orderId, stockId, symbol);
        }
      },
      {
        connection,
        concurrency: this.config.get<number>(
          'MATCHING_QUEUE_CONCURRENCY',
          8,
        ),
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`job ${job?.id} failed: ${String(err)}`);
    });

    this.logger.log(`BullMQ queue "${queueName}" worker started`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueueAccepted(orderId: string, stockId: string): Promise<void> {
    await this.queue!.add(
      'accepted',
      { orderId, stockId },
      {
        // Xóa hash job/completed ngay — luồng khớp không cần lịch sử trong Redis.
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
  }

  async enqueueCancelled(
    orderId: string,
    stockId: string,
    symbol: string,
  ): Promise<void> {
    await this.queue!.add(
      'cancelled',
      { orderId, stockId, symbol },
      {
        // Xóa hash job/completed ngay — luồng khớp không cần lịch sử trong Redis.
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );
  }
}
