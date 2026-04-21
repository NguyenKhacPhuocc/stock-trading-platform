import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('analysis/:symbol')
  analyze(@Param('symbol') symbol: string) {
    return this.ai.analyze(symbol);
  }

  @Get('indicators/:symbol')
  getIndicators(@Param('symbol') symbol: string) {
    return this.ai.getIndicators(symbol);
  }
}
