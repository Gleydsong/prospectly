import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '../../../common/professional-persona';

export class PatchOrganizationPersonaDto {
  @ApiProperty({ enum: PROFESSIONAL_PERSONAS })
  @IsIn(PROFESSIONAL_PERSONAS)
  defaultPersona!: ProfessionalPersona;
}
