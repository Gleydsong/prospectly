import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateCampaignStatusDto {
  @ApiProperty({ enum: CampaignStatus })
  @IsEnum(CampaignStatus)
  @IsNotEmpty()
  status!: CampaignStatus;
}
