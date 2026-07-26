import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty({ example: 'novo@empresa.com' })
  @IsEmail()
  newEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword!: string;
}
