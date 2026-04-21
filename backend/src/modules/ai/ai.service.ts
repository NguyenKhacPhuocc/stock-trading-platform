import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiUrl: string;

  constructor(config: ConfigService) {
    this.aiUrl = config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async analyze(symbol: string): Promise<unknown> {
    try {
      const res = await fetch(`${this.aiUrl}/analyze/${symbol}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`AI service trả về ${res.status}`);
      const body = (await res.json()) as unknown;
      return body;
    } catch (err) {
      this.logger.error(
        `Không thể kết nối AI service: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'AI service tạm thời không khả dụng',
      );
    }
  }

  async getIndicators(symbol: string): Promise<unknown> {
    try {
      const res = await fetch(`${this.aiUrl}/indicators/${symbol}`);
      if (!res.ok) throw new Error(`AI service trả về ${res.status}`);
      const body = (await res.json()) as unknown;
      return body;
    } catch (err) {
      this.logger.error(`Không thể lấy indicators: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'AI service tạm thời không khả dụng',
      );
    }
  }
}
