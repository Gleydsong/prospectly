import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional } from 'class-validator';

/** Body refresh is optional fallback for one release; prefer HttpOnly cookie. */
export class RefreshTokenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
