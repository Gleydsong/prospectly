import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLocale } from '@prisma/client';

import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { buildWaitlistConfirmationEmail, buildWaitlistNotifyEmail } from './waitlist-email';

export type JoinWaitlistResult = { message: string };

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async join(dto: JoinWaitlistDto): Promise<JoinWaitlistResult> {
    const ok: JoinWaitlistResult = {
      message:
        (dto.locale ?? AppLocale.pt) === AppLocale.en
          ? 'You’re on the waitlist. Check your email.'
          : 'Você entrou na lista de espera. Confira seu e-mail.',
    };

    // Honeypot: pretend success without storing or mailing
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn('Waitlist honeypot triggered');
      return ok;
    }

    const email = dto.email.trim().toLowerCase();
    const locale = dto.locale ?? AppLocale.pt;
    const source = dto.source?.trim().slice(0, 80) || 'landing-home';

    const existing = await this.prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      return ok;
    }

    let entry: { id: string };
    try {
      entry = await this.prisma.waitlistEntry.create({
        data: { email, locale, source },
      });
    } catch (error) {
      // Concurrent joins for the same email: treat as idempotent success and do not re-mail.
      if (this.isUniqueConstraintViolation(error)) {
        return ok;
      }
      throw error;
    }

    try {
      const confirmation = this.confirmationMail(email, locale);
      await this.mail.send(confirmation);
      await this.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        { template: 'waitlist-confirmation', outcome: 'failed' },
        `Failed to send waitlist confirmation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const notifyTo = this.config.get<string>('waitlist.notifyTo')?.trim();
    if (notifyTo) {
      try {
        const notify = buildWaitlistNotifyEmail({ email, locale, source });
        await this.mail.send({
          to: notifyTo,
          subject: notify.subject,
          text: notify.text,
          html: notify.html,
          template: notify.template,
        });
      } catch (err) {
        this.logger.error(
          { template: 'waitlist-notify', outcome: 'failed' },
          `Failed to notify team about waitlist: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return ok;
  }

  private confirmationMail(email: string, locale: AppLocale) {
    const content = buildWaitlistConfirmationEmail(
      locale,
      this.config.get<string>('landingUrl'),
    );
    return {
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      template: 'waitlist-confirmation',
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
