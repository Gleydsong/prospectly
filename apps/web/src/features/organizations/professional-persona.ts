export const PROFESSIONAL_PERSONAS = [
  'vendedor',
  'desenvolvedor',
  'trafego_pago',
  'marketing',
  'outro',
] as const;

export type ProfessionalPersona = (typeof PROFESSIONAL_PERSONAS)[number];

export const LEAD_WEBSITE_KINDS = ['site', 'landing', 'app'] as const;
export type LeadWebsiteKind = (typeof LEAD_WEBSITE_KINDS)[number];

export function effectivePersona(
  defaultPersona: ProfessionalPersona,
  personaOverride: ProfessionalPersona | null,
): ProfessionalPersona {
  return personaOverride ?? defaultPersona;
}

export function isPrimarySitesPersona(persona: ProfessionalPersona | undefined): boolean {
  return persona === 'desenvolvedor' || persona === 'marketing';
}

export function isWonClientFile(lead: {
  status?: string;
  stage?: { isWon?: boolean } | null;
}): boolean {
  return lead.status === 'WON' || lead.stage?.isWon === true;
}
