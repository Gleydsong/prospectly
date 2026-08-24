import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AppmaxInstallationHealthDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  app_id!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  client_id?: string;

  // Accepted only because Appmax may send it. It is deliberately never persisted.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  client_secret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  client_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  external_key?: string;
}
