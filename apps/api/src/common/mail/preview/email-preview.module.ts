import { Module } from '@nestjs/common';

import { EmailPreviewController } from './email-preview.controller';

@Module({
  controllers: [EmailPreviewController],
})
export class EmailPreviewModule {}

export function shouldEnableEmailPreview(): boolean {
  const env = process.env.NODE_ENV ?? 'development';
  if (env === 'production' || env === 'staging') return false;
  return process.env.EMAIL_PREVIEW === 'true';
}
