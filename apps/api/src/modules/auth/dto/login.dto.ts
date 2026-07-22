import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@prospectly.dev' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'Demo123!' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
