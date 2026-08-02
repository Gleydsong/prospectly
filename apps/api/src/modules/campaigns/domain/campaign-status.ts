import type { CampaignStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const ALLOWED: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ['SCHEDULED', 'RUNNING', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Status transitions for assisted campaigns — never triggers outbound send. */
export function assertCampaignStatusTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): void {
  if (from === to) {
    return;
  }
  const allowed = ALLOWED[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      message: 'Invalid campaign status transition',
      from,
      to,
      allowed,
    });
  }
}
