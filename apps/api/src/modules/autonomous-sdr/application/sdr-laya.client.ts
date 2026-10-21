import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SdrDecisionProvider } from '../domain/sdr-decisions';

export const QUESTIONS = {
  icpFit: {
    type: 'score',
    instructions:
      'How well does this local business match a website and commercial outreach offer? Use only the facts in state.',
    criteria: ['none', 'partial', 'full'],
  },
  websiteNeed: {
    type: 'noul',
    instructions: 'Does this business need a better website or clearer digital presence?',
    criteria: { true: 'No site, or the site is missing.', false: 'A website is already present.' },
  },
  businessActivity: {
    type: 'noul',
    instructions: 'Does the listing look like an active local business?',
    criteria: {
      true: 'Name, place, or rating shows a real operating business.',
      false: 'Too little to treat it as active.',
    },
  },
  commercialOpportunity: {
    type: 'score',
    instructions: 'How commercially worth a first human outreach is this customer?',
    criteria: ['none', 'partial', 'full'],
  },
  contactability: {
    type: 'noul',
    instructions: 'Can a person reach this business by phone, email, or WhatsApp?',
    criteria: { true: 'A phone, email, or WhatsApp is present.', false: 'No contact channel is present.' },
  },
  buyingSignals: {
    type: 'noul',
    instructions: 'Is there a concrete signal they might buy help with their site or demand?',
    criteria: {
      true: 'Missing site or weak presence plus a way to contact them.',
      false: 'No buying signal in the facts.',
    },
  },
  risk: {
    type: 'score',
    instructions: 'How risky is it to contact this customer? Do-not-contact is absolute.',
    criteria: ['none', 'partial', 'full'],
  },
  strategy: {
    type: 'choice',
    instructions: 'Which outreach angle fits, if any?',
    criteria: {
      website_problem: 'The website is missing or weak.',
      growth_opportunity: 'The business looks active and could grow demand.',
      social_proof: 'Rating or reviews are the useful hook.',
      conversion_improvement: 'A site exists but contact or conversion is weak.',
      local_market: 'The local presence itself is the hook.',
    },
  },
  intent: {
    type: 'choice',
    instructions: 'What intent can be inferred before any message is sent? Unknown is allowed.',
    criteria: {
      INTERESTED: 'Facts suggest interest.',
      MEETING_REQUEST: 'Facts suggest they want a meeting.',
      QUESTION: 'Facts suggest an open question.',
      NOT_NOW: 'Not a fit right now.',
      NOT_INTERESTED: 'Not a fit.',
      OPT_OUT: 'Do not contact.',
      UNKNOWN: 'Not enough to infer intent.',
    },
  },
} as const;

@Injectable()
export class SdrLayaClient implements SdrDecisionProvider {
  constructor(private readonly config: ConfigService) {}

  async judge(request: unknown): Promise<unknown> {
    const baseUrl = (
      this.config.get<string>('laya.url') ?? 'http://localhost:8000/v1/systemone'
    ).replace(/\/$/, '');
    const model = this.config.get<string>('laya.model') ?? 'multilingual';
    const timeoutMs = resolveLayaTimeoutMs(this.config.get('laya.timeoutMs'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ model, state: request, questions: QUESTIONS }),
      });

      if (!response.ok) {
        throw new Error(`laya http ${response.status}`);
      }

      const payload = (await response.json()) as { answers?: unknown };
      if (!payload.answers || typeof payload.answers !== 'object' || Array.isArray(payload.answers)) {
        throw new Error('laya response missing answers');
      }

      return { answers: payload.answers };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function resolveLayaTimeoutMs(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 20_000;
  return Math.min(value, 30_000);
}
