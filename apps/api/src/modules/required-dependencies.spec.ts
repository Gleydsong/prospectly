import { getQueueToken } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../common/prisma/prisma.service';
import { AuditModule } from './audit/audit.module';
import { AuditService } from './audit/audit.service';
import { CampaignsService } from './campaigns/application/campaigns.service';
import { TemplatesService } from './campaigns/application/templates.service';
import { CampaignsModule } from './campaigns/campaigns.module';
import { LeadIngestionService } from './leads/lead-ingestion.service';
import { LeadsModule } from './leads/leads.module';
import { LeadsService } from './leads/leads.service';
import { OUTBOX_QUEUE } from './outbox/outbox.constants';
import { OutboxService } from './outbox/outbox.service';
import { SuppressionService } from './privacy/suppression.service';
import { SCORING_QUEUE } from './scoring/scoring.constants';
import { TasksModule } from './tasks/tasks.module';
import { TasksService } from './tasks/tasks.service';
import { WEBSITE_ANALYSIS_QUEUE } from './website-analysis/website-analysis.constants';

describe('Required Dependencies DI Proof (Issue #319)', () => {
  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(undefined),
  };

  @Global()
  @Module({
    imports: [AuditModule],
    providers: [
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ConfigService, useValue: mockConfig },
    ],
    exports: [AuditModule, PrismaService, ConfigService],
  })
  class TestGlobalPrismaModule {}

  describe('Successful Nest DI compilation with real modules', () => {
    it('compiles CampaignsModule and resolves mandatory SuppressionService, OutboxService, and LeadsService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [TestGlobalPrismaModule, CampaignsModule],
      })
        .overrideProvider(getQueueToken(OUTBOX_QUEUE))
        .useValue(mockQueue)
        .overrideProvider(getQueueToken(WEBSITE_ANALYSIS_QUEUE))
        .useValue(mockQueue)
        .overrideProvider(getQueueToken(SCORING_QUEUE))
        .useValue(mockQueue)
        .compile();

      const campaignsService = moduleRef.get(CampaignsService);
      const suppressionService = moduleRef.get(SuppressionService);
      const outboxService = moduleRef.get(OutboxService);
      const leadsService = moduleRef.get(LeadsService);

      expect(campaignsService).toBeDefined();
      expect(suppressionService).toBeDefined();
      expect(outboxService).toBeDefined();
      expect(leadsService).toBeDefined();
      await moduleRef.close();
    });

    it('compiles LeadsModule and resolves mandatory SuppressionService and OutboxService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [TestGlobalPrismaModule, LeadsModule],
      })
        .overrideProvider(getQueueToken(OUTBOX_QUEUE))
        .useValue(mockQueue)
        .overrideProvider(getQueueToken(WEBSITE_ANALYSIS_QUEUE))
        .useValue(mockQueue)
        .overrideProvider(getQueueToken(SCORING_QUEUE))
        .useValue(mockQueue)
        .compile();

      const leadIngestionService = moduleRef.get(LeadIngestionService);
      const leadsService = moduleRef.get(LeadsService);
      const suppressionService = moduleRef.get(SuppressionService);
      const outboxService = moduleRef.get(OutboxService);

      expect(leadIngestionService).toBeDefined();
      expect(leadsService).toBeDefined();
      expect(suppressionService).toBeDefined();
      expect(outboxService).toBeDefined();
      await moduleRef.close();
    });

    it('compiles TasksModule and resolves mandatory OutboxService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [TestGlobalPrismaModule, TasksModule],
      })
        .overrideProvider(getQueueToken(OUTBOX_QUEUE))
        .useValue(mockQueue)
        .compile();

      const tasksService = moduleRef.get(TasksService);
      const outboxService = moduleRef.get(OutboxService);

      expect(tasksService).toBeDefined();
      expect(outboxService).toBeDefined();
      await moduleRef.close();
    });
  });

  it('resolves ingestion without optional website enrichment', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadIngestionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuppressionService, useValue: {} },
        { provide: OutboxService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(LeadIngestionService)).toBeInstanceOf(LeadIngestionService);
    await moduleRef.close();
  });

  describe('Boot fails when mandatory dependencies are missing', () => {
    it('fails boot for CampaignsService when SuppressionService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            CampaignsService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: TemplatesService, useValue: {} },
            { provide: AuditService, useValue: {} },
            { provide: OutboxService, useValue: {} },
            { provide: LeadsService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(/argument SuppressionService at index \[3\]/);
    });

    it('fails boot for CampaignsService when OutboxService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            CampaignsService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: TemplatesService, useValue: {} },
            { provide: AuditService, useValue: {} },
            { provide: SuppressionService, useValue: {} },
            { provide: LeadsService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(/argument OutboxService at index \[4\]/);
    });

    it('fails boot for CampaignsService when LeadsService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            CampaignsService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: TemplatesService, useValue: {} },
            { provide: AuditService, useValue: {} },
            { provide: SuppressionService, useValue: {} },
            { provide: OutboxService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(/argument LeadsService at index \[5\]/);
    });

    it('fails boot for LeadIngestionService when SuppressionService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            LeadIngestionService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: OutboxService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(/argument SuppressionService at index \[1\]/);
    });

    it('fails boot for LeadIngestionService when OutboxService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            LeadIngestionService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: SuppressionService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(/argument OutboxService at index \[2\]/);
    });

    it('fails boot for TasksService when OutboxService is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [TasksService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile(),
      ).rejects.toThrow(/argument OutboxService at index \[1\]/);
    });
  });
});
