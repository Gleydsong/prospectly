import { Controller, Delete, Get, Headers, Post, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { runWithTenant } from '../../common/prisma/tenant-context';
import { PluginAccessService } from '../integrations/plugin-access.service';
import {
  buildWwwAuthenticate,
  isMcpAccessToken,
  issuerFromMcpResource,
  parseMcpBearer,
  protectedResourceMetadataUrl,
} from '../oauth/oauth-protocol';
import { OauthService } from '../oauth/oauth.service';
import { createProspectlyMcpServer } from './mcp.server';

@ApiTags('mcp')
@Controller({ path: 'mcp', version: VERSION_NEUTRAL })
export class McpController {
  constructor(
    private readonly oauth: OauthService,
    private readonly plugins: PluginAccessService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post()
  async post(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    await this.handle(req, res, authorization);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  async get(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    await this.handle(req, res, authorization);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Delete()
  async delete(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    await this.handle(req, res, authorization);
  }

  private metadataUrl(): string {
    return protectedResourceMetadataUrl(issuerFromMcpResource(this.oauth.mcpResourceUrl()));
  }

  private unauthorized(res: Response, message: string): void {
    res.setHeader('WWW-Authenticate', buildWwwAuthenticate(this.metadataUrl()));
    res.status(401).json({ statusCode: 401, error: 'invalid_token', message });
  }

  private async handle(req: Request, res: Response, authorization?: string): Promise<void> {
    const raw = parseMcpBearer(authorization);
    if (!raw || !isMcpAccessToken(raw)) {
      this.unauthorized(res, 'MCP access token required');
      return;
    }

    try {
      const claims = await this.oauth.resolveAccessToken(raw);
      await runWithTenant(
        claims.organizationId,
        async () => {
          const server = createProspectlyMcpServer((resource, limit) =>
            this.plugins.extract(claims.organizationId, resource, limit),
          );
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
          } finally {
            const shutdown = () => {
              void transport.close();
              void server.close();
            };
            if (res.writableEnded) shutdown();
            else res.on('close', shutdown);
          }
        },
        claims.userId,
      );
    } catch {
      if (!res.headersSent) {
        this.unauthorized(res, 'MCP access token is invalid');
      }
    }
  }
}
