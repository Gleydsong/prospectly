import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CUSTOM_FIELD_API_TYPES, MAX_NAME_LENGTH, MAX_SELECT_OPTIONS } from '../custom-fields.service';

export class CreateCustomFieldOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  label!: string;
}

export class CreateCustomFieldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name!: string;

  @ApiProperty({ enum: CUSTOM_FIELD_API_TYPES })
  @IsIn(CUSTOM_FIELD_API_TYPES)
  type!: (typeof CUSTOM_FIELD_API_TYPES)[number];

  @ApiPropertyOptional({ type: [CreateCustomFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECT_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomFieldOptionDto)
  options?: CreateCustomFieldOptionDto[];
}

export class UpdateCustomFieldOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class UpdateCustomFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({ enum: CUSTOM_FIELD_API_TYPES })
  @IsOptional()
  @IsIn(CUSTOM_FIELD_API_TYPES)
  type?: (typeof CUSTOM_FIELD_API_TYPES)[number];

  @ApiPropertyOptional({ type: [UpdateCustomFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECT_OPTIONS * 2)
  @ValidateNested({ each: true })
  @Type(() => UpdateCustomFieldOptionDto)
  options?: UpdateCustomFieldOptionDto[];
}

export class ReorderCustomFieldsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}
