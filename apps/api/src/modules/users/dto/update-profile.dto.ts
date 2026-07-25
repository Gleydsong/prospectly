import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MAX_AVATAR_BYTES = 120 * 1024;
const MAX_HTTPS_AVATAR_LENGTH = 500;
const MAX_DATA_AVATAR_LENGTH = 200_000;

@ValidatorConstraint({ name: 'isAvatarUrl', async: false })
export class IsAvatarUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) {
      return false;
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          value.length <= MAX_HTTPS_AVATAR_LENGTH
        );
      } catch {
        return false;
      }
    }

    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
    if (!match?.[2] || value.length > MAX_DATA_AVATAR_LENGTH) {
      return false;
    }

    const decoded = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    return decoded.length > 0 && decoded.length <= MAX_AVATAR_BYTES;
  }

  defaultMessage(): string {
    return `avatarUrl must be an http(s) URL (max ${MAX_HTTPS_AVATAR_LENGTH} chars) or a jpeg/png/webp data URL (max ${MAX_AVATAR_BYTES} bytes decoded)`;
  }
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'HTTPS image URL or compressed data:image/*;base64,… (max ~120KB decoded)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DATA_AVATAR_LENGTH)
  @Validate(IsAvatarUrlConstraint)
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: ['pt', 'en'] })
  @IsOptional()
  @IsIn(['pt', 'en'])
  locale?: 'pt' | 'en';
}
