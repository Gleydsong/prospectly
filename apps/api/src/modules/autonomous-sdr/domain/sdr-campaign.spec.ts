import { defaultAutonomyFlags } from './autonomy-flags';
import { InvalidSdrCampaignError } from './sdr-errors';
import {
  assertSdrCampaignTransition,
  createSdrCampaign,
  sdrCampaignOutreach,
} from './sdr-campaign';

const validCampaign = {
  id: 'cmp-1',
  organizationId: 'org-a',
  ownerId: 'user-1',
  name: 'Oficinas locais',
  objective: 'BOOK_MEETING' as const,
  offer: {
    name: 'Site',
    description: 'Site rapido para oficinas',
    valueProposition: 'Mais pedidos pelo celular',
  },
  icp: {
    industries: ['oficina'],
    geographies: ['Recife'],
    requiredSignals: ['no-ssl'],
    exclusions: [] as string[],
  },
  channels: ['EMAIL' as const],
  limits: { maxProspectsPerDay: 20, maxMessagesPerDay: 30, maxFollowUps: 3 },
  autonomyLevel: 'ASSISTED' as const,
};

describe('createSdrCampaign', () => {
  it('starts a draft from a structured ICP and does not enable sending', () => {
    expect(createSdrCampaign(validCampaign)).toEqual({
      ...validCampaign,
      status: 'DRAFT',
    });
  });

  it('rejects free text in place of structured ICP criteria', () => {
    expect(() =>
      createSdrCampaign({
        ...validCampaign,
        icp: { description: 'oficinas em Recife que precisam de site' },
      }),
    ).toThrow(InvalidSdrCampaignError);
  });

  it('rejects autonomous WhatsApp because sending stays manual', () => {
    expect(() =>
      createSdrCampaign({
        ...validCampaign,
        channels: ['WHATSAPP'],
        autonomyLevel: 'AUTONOMOUS',
      }),
    ).toThrow(InvalidSdrCampaignError);
  });

  it('rejects a campaign without an organization', () => {
    expect(() => createSdrCampaign({ ...validCampaign, organizationId: '  ' })).toThrow(
      InvalidSdrCampaignError,
    );
  });
});

describe('assertSdrCampaignTransition', () => {
  it('activates a draft and refuses to complete or reopen a finished campaign', () => {
    expect(() => assertSdrCampaignTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertSdrCampaignTransition('ACTIVE', 'PAUSED')).not.toThrow();
    expect(() => assertSdrCampaignTransition('PAUSED', 'ACTIVE')).not.toThrow();
    expect(() => assertSdrCampaignTransition('ACTIVE', 'COMPLETED')).not.toThrow();
    expect(() => assertSdrCampaignTransition('PAUSED', 'COMPLETED')).not.toThrow();

    expect(() => assertSdrCampaignTransition('DRAFT', 'COMPLETED')).toThrow(
      InvalidSdrCampaignError,
    );
    expect(() => assertSdrCampaignTransition('COMPLETED', 'ACTIVE')).toThrow(
      InvalidSdrCampaignError,
    );
  });
});

describe('sdrCampaignOutreach', () => {
  it('allows autonomous email only when the campaign is active and the flag is on', () => {
    const draft = createSdrCampaign({ ...validCampaign, autonomyLevel: 'AUTONOMOUS' });
    const active = { ...draft, status: 'ACTIVE' as const };
    const flagsOn = { ...defaultAutonomyFlags(), autonomousSending: true };

    expect(sdrCampaignOutreach(draft, flagsOn)).toBe('BLOCK');
    expect(sdrCampaignOutreach(active, defaultAutonomyFlags())).toBe('BLOCK');
    expect(sdrCampaignOutreach({ ...active, status: 'PAUSED' }, flagsOn)).toBe('BLOCK');
    expect(sdrCampaignOutreach(active, flagsOn)).toBe('ALLOW');
  });

  it('keeps assisted and WhatsApp campaigns on human approval', () => {
    const assisted = { ...createSdrCampaign(validCampaign), status: 'ACTIVE' as const };
    const whatsapp = {
      ...createSdrCampaign({
        ...validCampaign,
        channels: ['WHATSAPP'],
        autonomyLevel: 'ASSISTED',
      }),
      status: 'ACTIVE' as const,
    };
    const flagsOn = { ...defaultAutonomyFlags(), autonomousSending: true };

    expect(sdrCampaignOutreach(assisted, flagsOn)).toBe('REQUIRE_APPROVAL');
    expect(sdrCampaignOutreach(whatsapp, flagsOn)).toBe('REQUIRE_APPROVAL');
  });
});
