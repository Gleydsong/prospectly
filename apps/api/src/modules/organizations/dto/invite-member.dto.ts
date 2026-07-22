import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@agency.dev' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'João Souza' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: Role, example: 'SALES' })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ minLength: 8, description: 'Temporary password for the invited member' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  temporaryPassword!: string;
}
