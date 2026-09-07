import { Module } from '@nestjs/common';

import { GoogleOAuthHttpAdapter } from './google-oauth.adapter';
import { GOOGLE_OAUTH_PORT } from './google-oauth.port';
import { GoogleConnectionsController } from './google-connections.controller';
import { GoogleConnectionsService } from './google-connections.service';

@Module({
  controllers: [GoogleConnectionsController],
  providers: [
    GoogleConnectionsService,
    { provide: GOOGLE_OAUTH_PORT, useClass: GoogleOAuthHttpAdapter },
  ],
  exports: [GoogleConnectionsService],
})
export class GoogleConnectionsModule {}
