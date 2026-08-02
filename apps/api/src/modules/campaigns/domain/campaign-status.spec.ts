import { BadRequestException } from '@nestjs/common';

import { assertCampaignStatusTransition } from './campaign-status';

describe('assertCampaignStatusTransition', () => {
  it('allows DRAFT to RUNNING and SCHEDULED', () => {
    expect(() => assertCampaignStatusTransition('DRAFT', 'RUNNING')).not.toThrow();
    expect(() => assertCampaignStatusTransition('DRAFT', 'SCHEDULED')).not.toThrow();
  });

  it('rejects CANCELLED returning to active states', () => {
    expect(() => assertCampaignStatusTransition('CANCELLED', 'RUNNING')).toThrow(
      BadRequestException,
    );
    expect(() => assertCampaignStatusTransition('COMPLETED', 'RUNNING')).toThrow(
      BadRequestException,
    );
  });

  it('allows PAUSED to RUNNING or COMPLETED', () => {
    expect(() => assertCampaignStatusTransition('PAUSED', 'RUNNING')).not.toThrow();
    expect(() => assertCampaignStatusTransition('PAUSED', 'COMPLETED')).not.toThrow();
  });
});
