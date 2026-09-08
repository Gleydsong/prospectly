import { Module, forwardRef } from '@nestjs/common';

import { CommunicationsModule } from '../communications/communications.module';
import { GoogleOAuthHttpAdapter } from './google-oauth.adapter';
import { GOOGLE_OAUTH_PORT } from './google-oauth.port';
import { GoogleConnectionsController } from './google-connections.controller';
import { GoogleConnectionsService } from './google-connections.service';

@Module({
  imports: [forwardRef(() => CommunicationsModule)],
  controllers: [GoogleConnectionsController],
  providers: [
    GoogleConnectionsService,
    { provide: GOOGLE_OAUTH_PORT, useClass: GoogleOAuthHttpAdapter },
  ],
  exports: [GoogleConnectionsService],
})
export class GoogleConnectionsModule {}
