import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { LeadsModule } from '../leads/leads.module';
import { CsvParserService } from './csv-parser.service';
import { IMPORTS_QUEUE } from './imports.constants';
import { ImportsController } from './imports.controller';
import { ImportsDispatchReconciler } from './imports-dispatch.reconciler';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: config.get<number>('csv.maxFileSizeBytes') ?? 5 * 1024 * 1024, files: 1 },
      }),
    }),
    BullModule.registerQueue({ name: IMPORTS_QUEUE }),
    LeadsModule,
  ],
  controllers: [ImportsController],
  providers: [
    CsvParserService,
    ImportsService,
    {
      provide: ImportsDispatchReconciler,
      inject: [ImportsService],
      useFactory: (service: ImportsService) => new ImportsDispatchReconciler(service),
    },
  ],
  exports: [ImportsService],
})
export class ImportsModule {}
