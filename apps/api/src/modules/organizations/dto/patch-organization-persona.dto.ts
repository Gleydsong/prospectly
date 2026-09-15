import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '../../../common/professional-persona';

export class PatchOrganizationPersonaDto {
  @ApiProperty({ enum: PROFESSIONAL_PERSONAS })
  @IsIn(PROFESSIONAL_PERSONAS)
  defaultPersona!: ProfessionalPersona;

  @ApiPropertyOptional({
    example: 'Fotógrafo',
    description: 'Required (2–40 chars) when defaultPersona is outro; ignored otherwise',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  personaOtherLabel?: string | null;
}
