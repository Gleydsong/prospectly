import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString } from 'class-validator';

import { ORGANIZATION_FLAG_KEYS, type OrganizationFlagKey } from '../organization-flags.constants';

export class OrganizationFlagKeyParamDto {
  @ApiProperty({ enum: ORGANIZATION_FLAG_KEYS })
  @IsString()
  @IsIn([...ORGANIZATION_FLAG_KEYS])
  key!: OrganizationFlagKey;
}

export class UpdateOrganizationFlagDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
