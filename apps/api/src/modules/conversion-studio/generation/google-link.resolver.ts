import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { LandingGenerationContext } from './providers/landing-generation.provider';
import {
  expandGoogleShortLink,
  parseGoogleMapsLink,
  type ParsedGoogleMapsLink,
} from './google-link.parser';

type GooglePlaceDetails = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
};

@Injectable()
export class GoogleLinkResolver {
  private readonly logger = new Logger(GoogleLinkResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolve(
    organizationId: string,
    googleLink: string,
  ): Promise<{
    context: LandingGenerationContext;
    matchedLeadId?: string;
    parsed: ParsedGoogleMapsLink;
  }> {
    const expanded = await expandGoogleShortLink(googleLink.trim());
    const parsed = parseGoogleMapsLink(expanded);

    if (parsed.placeId) {
      const byExternal = await this.prisma.lead.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { externalId: `places/${parsed.placeId}` },
            { externalId: parsed.placeId },
          ],
        },
      });
      if (byExternal) {
        return {
          matchedLeadId: byExternal.id,
          parsed,
          context: this.leadToContext(byExternal),
        };
      }
    }

    if (parsed.placeName || parsed.query) {
      const name = (parsed.placeName || parsed.query || '').trim();
      if (name.length >= 3) {
        const byName = await this.prisma.lead.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            companyName: { contains: name.slice(0, 80), mode: 'insensitive' },
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (byName) {
          return {
            matchedLeadId: byName.id,
            parsed,
            context: this.leadToContext(byName),
          };
        }
      }
    }

    const fromApi = await this.fetchFromPlacesApi(parsed);
    if (fromApi) {
      return { parsed, context: fromApi };
    }

    const companyName =
      parsed.placeName ||
      parsed.query ||
      'Negócio do Google Maps';

    return {
      parsed,
      context: {
        companyName: companyName.slice(0, 120),
        address: undefined,
        describeText: [
          `Negócio encontrado via link do Google Maps.`,
          parsed.query ? `Busca: ${parsed.query}` : null,
          parsed.placeId ? `place_id: ${parsed.placeId}` : null,
          `URL: ${parsed.rawUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    };
  }

  private leadToContext(lead: {
    companyName: string;
    tradeName?: string | null;
    category?: string | null;
    segment?: string | null;
    description?: string | null;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    website?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    externalId?: string | null;
  }): LandingGenerationContext {
    return {
      companyName: lead.companyName,
      tradeName: lead.tradeName,
      category: lead.category,
      segment: lead.segment,
      description: lead.description,
      city: lead.city,
      state: lead.state,
      address: lead.address,
      phone: lead.phone ?? lead.whatsapp,
      email: lead.email,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      externalId: lead.externalId,
      googlePlaceId: lead.externalId,
    };
  }

  private async fetchFromPlacesApi(
    parsed: ParsedGoogleMapsLink,
  ): Promise<LandingGenerationContext | null> {
    const apiKey = this.config.get<string>('googlePlaces.apiKey') ?? '';
    if (!apiKey) return null;

    const baseUrl = (
      this.config.get<string>('googlePlaces.baseUrl') ?? 'https://places.googleapis.com/v1'
    ).replace(/\/$/, '');
    const timeoutMs = this.config.get<number>('googlePlaces.timeoutMs') ?? 15_000;
    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'nationalPhoneNumber',
      'internationalPhoneNumber',
      'websiteUri',
      'rating',
      'userRatingCount',
      'location',
      'addressComponents',
    ].join(',');

    try {
      if (parsed.placeId) {
        const place = await this.requestJson<GooglePlaceDetails>(
          `${baseUrl}/places/${encodeURIComponent(parsed.placeId)}`,
          {
            method: 'GET',
            headers: {
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': fieldMask,
            },
            timeoutMs,
          },
        );
        return this.placeToContext(place, parsed);
      }

      const textQuery = parsed.query || parsed.placeName;
      if (!textQuery) return null;

      const search = await this.requestJson<{ places?: GooglePlaceDetails[] }>(
        `${baseUrl}/places:searchText`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask
              .split(',')
              .map((field) => `places.${field}`)
              .join(','),
          },
          body: JSON.stringify({ textQuery, languageCode: 'pt-BR', pageSize: 1 }),
          timeoutMs,
        },
      );
      const first = search.places?.[0];
      return first ? this.placeToContext(first, parsed) : null;
    } catch (error) {
      this.logger.warn({
        message: 'Google Places lookup failed for Maps link',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private placeToContext(
    place: GooglePlaceDetails,
    parsed: ParsedGoogleMapsLink,
  ): LandingGenerationContext {
    const city =
      place.addressComponents?.find((c) => c.types?.includes('locality'))?.longText ??
      place.addressComponents?.find((c) => c.types?.includes('administrative_area_level_2'))
        ?.longText;
    const state = place.addressComponents?.find((c) =>
      c.types?.includes('administrative_area_level_1'),
    )?.shortText;

    return {
      companyName: place.displayName?.text?.trim() || parsed.placeName || parsed.query || 'Negócio',
      address: place.formattedAddress,
      city,
      state,
      phone: place.internationalPhoneNumber || place.nationalPhoneNumber,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      website: place.websiteUri,
      googlePlaceId: place.id ?? parsed.placeId,
      externalId: place.id ? `places/${place.id}` : parsed.placeId ? `places/${parsed.placeId}` : null,
      describeText: `Dados públicos do Google Places. URL original: ${parsed.rawUrl}`,
    };
  }

  private async requestJson<T>(
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs);
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Places HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
