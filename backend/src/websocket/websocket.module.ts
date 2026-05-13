import { Module, forwardRef } from '@nestjs/common';
import { MatchingModule } from '../modules/matching/matching.module';
import { AppGateway } from './app.gateway';

@Module({
  imports: [forwardRef(() => MatchingModule)],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class WebsocketModule {}
