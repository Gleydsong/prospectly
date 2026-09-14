import { ApiProperty } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';

import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '../../../common/professional-persona';

export class PatchPersonaOverrideDto {
  @ApiProperty({ enum: PROFESSIONAL_PERSONAS, nullable: true })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsIn(PROFESSIONAL_PERSONAS)
  personaOverride!: ProfessionalPersona | null;
}
