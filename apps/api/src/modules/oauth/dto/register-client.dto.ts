import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

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
}
