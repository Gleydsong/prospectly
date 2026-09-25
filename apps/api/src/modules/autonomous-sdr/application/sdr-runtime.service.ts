import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { EMPTY_SDR_RUNTIME, runLocalSdrScenario, type SdrRuntimeView } from './sdr-runtime.scenario';

@Injectable()
export class SdrRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<SdrRuntimeView> {
    const row = await this.prisma.sdrRuntime.findUnique({
      where: { organizationId },
      select: { view: true },
    });
    return isRuntimeView(row?.view) ? row.view : EMPTY_SDR_RUNTIME;
  }

  async run(organizationId: string): Promise<SdrRuntimeView> {
    const view = await runLocalSdrScenario();
    await this.prisma.sdrRuntime.upsert({
      where: { organizationId },
      create: { organizationId, view },
      update: { view },
    });
    return view;
  }
}

function isRuntimeView(value: Prisma.JsonValue | undefined): value is SdrRuntimeView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return 'campaign' in value && 'autonomy' in value && 'prospects' in value;
}
