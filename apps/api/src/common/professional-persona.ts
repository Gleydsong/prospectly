import { BadRequestException } from '@nestjs/common';

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

export function normalizePersonaOtherLabel(
  persona: ProfessionalPersona,
  raw: string | null | undefined,
): string | null {
  if (persona !== 'outro') {
    return null;
  }

  const trimmed = raw?.trim() ?? '';
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new BadRequestException('personaOtherLabel is required when defaultPersona is outro');
  }

  return trimmed;
}
