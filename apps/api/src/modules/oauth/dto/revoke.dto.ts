import { IsOptional, IsString } from 'class-validator';

export class RevokeDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  token_type_hint?: string;

  @IsOptional()
  @IsString()
  client_id?: string;
}
