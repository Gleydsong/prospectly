import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ManageTagsDto {
  @ApiProperty({ type: [String], example: ['restaurante', 'sem-site'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags!: string[];
}

export class AssignOwnerDto {
  @ApiProperty()
  @IsString()
  ownerId!: string;
}
