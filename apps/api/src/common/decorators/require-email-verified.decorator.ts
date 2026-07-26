import { SetMetadata } from '@nestjs/common';

export const REQUIRE_EMAIL_VERIFIED_KEY = 'requireEmailVerified';
export const RequireEmailVerified = () => SetMetadata(REQUIRE_EMAIL_VERIFIED_KEY, true);
