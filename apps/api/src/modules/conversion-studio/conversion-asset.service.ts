import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_ASSET_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ConversionAssetService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, pageId: string) {
    await this.requirePage(organizationId, pageId);
    return this.prisma.conversionPageAsset.findMany({
      where: { organizationId, pageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registers an external HTTPS asset URL. Binary object storage (S3/R2) is
   * intentionally not wired here — Render filesystem is ephemeral.
   */
  async register(
    organizationId: string,
    pageId: string,
    input: { url: string; altText?: string },
  ) {
    await this.requirePage(organizationId, pageId);
    const url = this.assertHttpsAssetUrl(input.url);

    let contentType: string | undefined;
    let byteSize: number | undefined;
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new BadRequestException('Asset URL is not reachable');
      }
      contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || undefined;
      const length = response.headers.get('content-length');
      if (length) byteSize = Number(length);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to validate asset URL');
    }

    if (contentType && !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(`Unsupported content type: ${contentType}`);
    }
    if (byteSize != null && (!Number.isFinite(byteSize) || byteSize > MAX_ASSET_BYTES)) {
      throw new BadRequestException('Asset exceeds 5MB limit');
    }

    return this.prisma.conversionPageAsset.create({
      data: {
        organizationId,
        pageId,
        url,
        altText: input.altText?.trim().slice(0, 160) || null,
        contentType,
        byteSize: byteSize && Number.isFinite(byteSize) ? Math.floor(byteSize) : null,
      },
    });
  }

  async remove(organizationId: string, pageId: string, assetId: string) {
    await this.requirePage(organizationId, pageId);
    const deleted = await this.prisma.conversionPageAsset.deleteMany({
      where: { id: assetId, pageId, organizationId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('Asset not found');
    }
  }

  private assertHttpsAssetUrl(raw: string): string {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid asset URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS asset URLs are allowed');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Credentials in asset URL are not allowed');
    }
    return parsed.toString();
  }

  private async requirePage(organizationId: string, pageId: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: { id: pageId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!page) throw new BadRequestException('Page not found in organization');
  }
}
