export type MemorySource = {
  organization: { id: string; name: string };
  campaigns: Array<{
    organizationId: string;
    id: string;
    name: string;
    status: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'COMPLETED';
  }>;
  prospects: Array<{ organizationId: string; id: string; campaignId: string; state: string }>;
  conversations: Array<{
    organizationId: string;
    prospectId: string;
    body: string;
    intent: string;
  }>;
};

type OrganizationView = { id: string; name: string };
type CampaignView = { organizationId: string; id: string; name: string; status: string };
type ProspectView = { organizationId: string; id: string; campaignId: string; state: string };
type ConversationView = {
  organizationId: string;
  prospectId: string;
  body: string;
  intent: string;
};

export type AgentContext = {
  organizationId: string;
  campaignName: string;
  prospectState: string;
  untrustedReply: string;
};

export class SdrMemoryProjection {
  private organizationView: OrganizationView | null = null;
  private readonly campaigns = new Map<string, CampaignView>();
  private readonly prospects = new Map<string, ProspectView>();
  private readonly conversations = new Map<string, ConversationView>();

  rebuild(source: MemorySource): void {
    this.organizationView = { id: source.organization.id, name: source.organization.name };
    this.campaigns.clear();
    this.prospects.clear();
    this.conversations.clear();
    const organizationId = source.organization.id;
    for (const campaign of source.campaigns) {
      if (campaign.organizationId !== organizationId) continue;
      this.campaigns.set(this.key(organizationId, campaign.id), { ...campaign });
    }
    for (const prospect of source.prospects) {
      if (prospect.organizationId !== organizationId) continue;
      this.prospects.set(this.key(organizationId, prospect.id), { ...prospect });
    }
    for (const conversation of source.conversations) {
      if (conversation.organizationId !== organizationId) continue;
      this.conversations.set(this.key(organizationId, conversation.prospectId), {
        ...conversation,
      });
    }
  }

  organization(id: string): OrganizationView | null {
    if (!this.organizationView || this.organizationView.id !== id) return null;
    return this.organizationView;
  }

  campaign(organizationId: string, campaignId: string): CampaignView | null {
    return this.campaigns.get(this.key(organizationId, campaignId)) ?? null;
  }

  prospect(organizationId: string, prospectId: string): ProspectView | null {
    return this.prospects.get(this.key(organizationId, prospectId)) ?? null;
  }

  conversation(organizationId: string, prospectId: string): ConversationView | null {
    return this.conversations.get(this.key(organizationId, prospectId)) ?? null;
  }

  contextForAgent(organizationId: string, prospectId: string): AgentContext | null {
    const prospect = this.prospect(organizationId, prospectId);
    if (!prospect) return null;
    const campaign = this.campaign(organizationId, prospect.campaignId);
    const conversation = this.conversation(organizationId, prospectId);
    return {
      organizationId,
      campaignName: campaign?.name ?? '',
      prospectState: prospect.state,
      untrustedReply: conversation?.body ?? '',
    };
  }

  private key(organizationId: string, id: string): string {
    return `${organizationId}\u0000${id}`;
  }
}
