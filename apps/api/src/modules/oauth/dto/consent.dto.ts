import { IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class ConsentDto {
  @IsString()
  client_id!: string;

  @IsString()
  redirect_uri!: string;

  @IsString()
  code_challenge!: string;

  @IsString()
  code_challenge_method!: string;

  @IsString()
  resource!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @ValidateIf((dto: ConsentDto) => dto.decision === 'allow')
  @IsUUID()
  organizationId?: string;

  @IsIn(['allow', 'deny'])
  decision!: 'allow' | 'deny';
}
