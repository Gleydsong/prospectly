import { Module } from '@nestjs/common';

import { OauthController } from './oauth.controller';
import { OauthMetadataController } from './oauth-metadata.controller';
import { OauthService } from './oauth.service';

@Module({
  controllers: [OauthController, OauthMetadataController],
  providers: [OauthService],
  exports: [OauthService],
})
export class OauthModule {}
