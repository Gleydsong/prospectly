import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertSafePublicUrl,
  SsrfBlockedError,
} from '../website-analysis/ssrf';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

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
    const url = await this.assertSafeHttpsAssetUrl(input.url);

    let contentType: string | undefined;
    let byteSize: number | undefined;
    let finalUrl = url;
    try {
      const head = await this.headWithSafeRedirects(url);
      finalUrl = head.url;
      contentType = head.contentType;
      byteSize = head.byteSize;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to validate asset URL');
    }

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        contentType
          ? `Unsupported content type: ${contentType}`
          : 'Asset URL must return an image Content-Type',
      );
    }
    if (byteSize != null && (!Number.isFinite(byteSize) || byteSize > MAX_ASSET_BYTES)) {
      throw new BadRequestException('Asset exceeds 5MB limit');
    }

    return this.prisma.conversionPageAsset.create({
      data: {
        organizationId,
        pageId,
        url: finalUrl,
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

  private async assertSafeHttpsAssetUrl(raw: string): Promise<string> {
    let parsed: URL;
    try {
      parsed = await assertSafePublicUrl(raw);
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Invalid asset URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS asset URLs are allowed');
    }
    return parsed.toString();
  }

  private async headWithSafeRedirects(startUrl: string): Promise<{
    url: string;
    contentType?: string;
    byteSize?: number;
  }> {
    let currentUrl = startUrl;
    const visited = new Set<string>();

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (visited.has(currentUrl)) {
        throw new BadRequestException('Redirect loop detected');
      }
      visited.add(currentUrl);
      currentUrl = await this.assertSafeHttpsAssetUrl(currentUrl);

      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BadRequestException('Asset URL redirect missing Location');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new BadRequestException('Asset URL is not reachable');
      }

      const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim() || undefined;
      const length = response.headers.get('content-length');
      const byteSize = length ? Number(length) : undefined;
      return { url: currentUrl, contentType, byteSize };
    }

    throw new BadRequestException('Too many redirects while validating asset URL');
  }

  private async requirePage(organizationId: string, pageId: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: { id: pageId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!page) throw new BadRequestException('Page not found in organization');
  }
}
