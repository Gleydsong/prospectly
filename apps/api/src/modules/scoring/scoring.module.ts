import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SCORING_QUEUE } from './scoring.constants';
import { ScoringController } from './scoring.controller';
import { ScoringProcessor } from './scoring.processor';
import { ScoringService } from './scoring.service';

@Module({
  imports: [BullModule.registerQueue({ name: SCORING_QUEUE })],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
