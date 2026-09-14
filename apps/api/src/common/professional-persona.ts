export const PROFESSIONAL_PERSONAS = [
  'vendedor',
  'desenvolvedor',
  'trafego_pago',
  'marketing',
  'outro',
] as const;

export type ProfessionalPersona = (typeof PROFESSIONAL_PERSONAS)[number];

export function effectivePersona(
  defaultPersona: ProfessionalPersona,
  personaOverride: ProfessionalPersona | null,
): ProfessionalPersona {
  return personaOverride ?? defaultPersona;
}
