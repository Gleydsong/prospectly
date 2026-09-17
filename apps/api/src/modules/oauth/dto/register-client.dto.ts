import { Allow, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class RegisterClientDto {
  @IsOptional()
  @IsString()
  client_name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  redirect_uris!: string[];

  @IsOptional()
  @IsString()
  token_endpoint_auth_method?: string;

  @Allow()
  grant_types?: unknown;

  @Allow()
  response_types?: unknown;

  @Allow()
  logo_uri?: unknown;

  @Allow()
  scope?: unknown;

  @Allow()
  client_uri?: unknown;

  @Allow()
  contacts?: unknown;

  @Allow()
  software_id?: unknown;

  @Allow()
  software_version?: unknown;

  @Allow()
  application_type?: unknown;
}
