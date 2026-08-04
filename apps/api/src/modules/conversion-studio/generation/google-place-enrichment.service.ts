import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { LandingGenerationContext } from './providers/landing-generation.provider';
import { buildDesignReferenceBrief } from './design-references';

type GooglePlacePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
};

type GooglePlaceReview = {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string };
};

type GooglePlaceDetails = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  photos?: GooglePlacePhoto[];
  reviews?: GooglePlaceReview[];
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
};

export type GooglePlacePhotoAsset = {
  url: string;
  alt: string;
};

@Injectable()
export class GooglePlaceEnrichmentService {
  private readonly logger = new Logger(GooglePlaceEnrichmentService.name);

  constructor(private readonly config: ConfigService) {}

  async enrichContext(base: LandingGenerationContext): Promise<LandingGenerationContext> {
    const designReference = buildDesignReferenceBrief({
      category: base.category,
      segment: base.segment,
      companyName: base.companyName,
    });

    const apiKey = this.config.get<string>('googlePlaces.apiKey')?.trim() ?? '';
    if (!apiKey) {
      return {
        ...base,
        designReference,
        googleEnrichmentStatus: 'skipped_no_api_key',
      };
    }

    try {
      const place = await this.resolvePlace(base);
      if (!place) {
        return {
          ...base,
          designReference,
          googleEnrichmentStatus: 'not_found',
        };
      }

      const companyName = place.displayName?.text?.trim() || base.companyName;
      const photos = await this.resolvePhotos(place.photos ?? [], companyName, 6);
      const reviews = (place.reviews ?? [])
        .map((review) => ({
          quote: review.text?.text?.trim() ?? '',
          author: review.authorAttribution?.displayName?.trim() || 'Cliente Google',
          rating: review.rating,
        }))
        .filter((item) => item.quote.length >= 12)
        .slice(0, 4);

      const city =
        place.addressComponents?.find((c) => c.types?.includes('locality'))?.longText ??
        place.addressComponents?.find((c) => c.types?.includes('administrative_area_level_2'))
          ?.longText ??
        base.city;
      const state =
        place.addressComponents?.find((c) => c.types?.includes('administrative_area_level_1'))
          ?.shortText ?? base.state;

      const category =
        place.primaryTypeDisplayName?.text?.trim() ||
        base.category ||
        place.types?.[0]?.replace(/_/g, ' ') ||
        null;

      const enrichedDesign = buildDesignReferenceBrief({
        category,
        segment: base.segment,
        companyName,
      });

      return {
        ...base,
        companyName,
        category,
        city,
        state,
        address: place.formattedAddress ?? base.address,
        phone:
          place.internationalPhoneNumber ||
          place.nationalPhoneNumber ||
          base.phone,
        rating: place.rating ?? base.rating,
        reviewCount: place.userRatingCount ?? base.reviewCount,
        description:
          place.editorialSummary?.text?.trim() ||
          base.description ||
          null,
        website: place.websiteUri ?? base.website,
        googleMapsUri: place.googleMapsUri ?? base.googleMapsUri,
        googlePlaceId: place.id ?? base.googlePlaceId,
        photos,
        googleReviews: reviews,
        designReference: enrichedDesign,
        googleEnrichmentStatus: photos.length > 0 ? 'enriched_with_photos' : 'enriched_no_photos',
        describeText: [
          base.describeText,
          place.editorialSummary?.text
            ? `Resumo Google: ${place.editorialSummary.text}`
            : null,
          place.googleMapsUri ? `Maps: ${place.googleMapsUri}` : null,
          photos.length
            ? `Fotos oficiais do estabelecimento via Google Places (${photos.length}). Use-as no hero e na gallery.`
            : 'Nenhuma foto pública encontrada no Google Places para este estabelecimento.',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    } catch (error) {
      this.logger.warn({
        message: 'Google place enrichment failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ...base,
        designReference,
        googleEnrichmentStatus: 'error',
      };
    }
  }

  private async resolvePlace(
    base: LandingGenerationContext,
  ): Promise<GooglePlaceDetails | null> {
    const placeId = this.extractPlaceId(base.googlePlaceId ?? base.externalId);
    if (placeId) {
      return this.fetchPlaceDetails(placeId);
    }

    const textQuery = [
      base.companyName,
      base.category,
      base.city,
      base.state,
      base.address,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (textQuery.length < 3) return null;
    return this.searchTextFirst(textQuery);
  }

  private extractPlaceId(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    const value = raw.trim();
    const match = value.match(/places\/([A-Za-z0-9_-]+)/);
    if (match?.[1]) return match[1];
    if (/^ChIJ[A-Za-z0-9_-]+$/.test(value) || /^[A-Za-z0-9_-]{20,}$/.test(value)) {
      return value.replace(/^places\//, '');
    }
    return null;
  }

  private async fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
    const { baseUrl, apiKey, timeoutMs, fieldMask } = this.placesConfig();
    return this.requestJson<GooglePlaceDetails>(
      `${baseUrl}/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        timeoutMs,
      },
    );
  }

  private async searchTextFirst(textQuery: string): Promise<GooglePlaceDetails | null> {
    const { baseUrl, apiKey, timeoutMs, fieldMask } = this.placesConfig();
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
    return search.places?.[0] ?? null;
  }

  private async resolvePhotos(
    photos: GooglePlacePhoto[],
    companyName: string,
    limit: number,
  ): Promise<GooglePlacePhotoAsset[]> {
    const assets: GooglePlacePhotoAsset[] = [];
    for (const photo of photos.slice(0, limit)) {
      if (!photo.name) continue;
      const url = await this.resolvePhotoUri(photo.name);
      if (!url || !url.startsWith('https://')) continue;
      assets.push({
        url,
        alt: `Foto de ${companyName}`,
      });
    }
    return assets;
  }

  private async resolvePhotoUri(photoName: string): Promise<string | null> {
    const { baseUrl, apiKey, timeoutMs } = this.placesConfig();
    const url = `${baseUrl}/${photoName}/media?maxHeightPx=1600&maxWidthPx=1600&skipHttpRedirect=true`;
    try {
      const payload = await this.requestJson<{ photoUri?: string }>(url, {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': apiKey },
        timeoutMs,
      });
      return payload.photoUri?.trim() || null;
    } catch (error) {
      this.logger.warn({
        message: 'Failed to resolve Google photo URI',
        photoName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private placesConfig() {
    const apiKey = this.config.get<string>('googlePlaces.apiKey')?.trim() ?? '';
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
      'photos',
      'editorialSummary',
      'types',
      'primaryTypeDisplayName',
      'reviews',
      'googleMapsUri',
    ].join(',');
    return { apiKey, baseUrl, timeoutMs, fieldMask };
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
