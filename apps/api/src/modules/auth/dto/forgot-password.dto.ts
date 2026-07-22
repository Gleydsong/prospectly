import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ana@agency.dev' })
  @IsEmail()
  @MaxLength(160)
  email!: string;
}
