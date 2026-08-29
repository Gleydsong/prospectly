import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { CONSENT_TYPES, type ConsentType } from '../consent.service';

export class PrivacyConsentDto {
  @ApiProperty({ enum: Object.values(CONSENT_TYPES) })
  @IsIn(Object.values(CONSENT_TYPES))
  type!: ConsentType;
}
