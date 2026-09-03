import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

import { assertSafeRecipient, sanitizeHeaderValue } from './email-html';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const resendKey = this.config.get<string>('resend.apiKey')?.trim();
    if (resendKey) return true;
    const host = this.config.get<string>('smtp.host')?.trim();
    return Boolean(host);
  }

  private isProdLike(): boolean {
    const env = this.config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development';
    return env === 'production' || env === 'staging';
  }

  async send(message: MailMessage): Promise<void> {
    const to = assertSafeRecipient(message.to);
    const subject = sanitizeHeaderValue(message.subject);
    const template = message.template ? sanitizeHeaderValue(message.template) : 'unspecified';
    const resendKey = this.config.get<string>('resend.apiKey')?.trim();
    const from =
      this.config.get<string>('resend.from') ??
      this.config.get<string>('smtp.from') ??
      'no-reply@prospectly.dev';

    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const { data, error } = await resend.emails.send({
          from,
          to,
          subject,
          text: message.text,
          html: message.html,
          ...(message.template
            ? { tags: [{ name: 'template', value: template.slice(0, 40) }] }
            : {}),
        });
        if (error) {
          this.logger.error(
            { template, provider: 'resend', outcome: 'failed', reason: error.message },
            'email send failed',
          );
          throw new ServiceUnavailableException(`Failed to send email via Resend: ${error.message}`);
        }
        this.logger.log(
          {
            template,
            provider: 'resend',
            outcome: 'sent',
            providerId: data?.id,
            timestamp: new Date().toISOString(),
          },
          'email sent',
        );
      } catch (err) {
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        this.logger.error(
          { template, provider: 'resend', outcome: 'failed' },
          'email send threw',
        );
        throw new ServiceUnavailableException('Failed to send email via Resend');
      }
      return;
    }

    const host = this.config.get<string>('smtp.host')?.trim();
    if (!host) {
      if (this.isProdLike()) {
        this.logger.error(
          { template, provider: 'none', outcome: 'failed' },
          'mail provider not configured',
        );
        throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
      }
      this.logger.log({ template, provider: 'noop', outcome: 'skipped' }, 'mail not configured');
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port') ?? 587,
      secure: false,
      auth: {
        user: this.config.get<string>('smtp.user') || undefined,
        pass: this.config.get<string>('smtp.password') || undefined,
      },
    });

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(
        {
          template,
          provider: 'smtp',
          outcome: 'sent',
          providerId: typeof info.messageId === 'string' ? info.messageId : undefined,
          timestamp: new Date().toISOString(),
        },
        'email sent',
      );
    } catch {
      this.logger.error({ template, provider: 'smtp', outcome: 'failed' }, 'smtp send failed');
      throw new ServiceUnavailableException('Failed to send email via SMTP');
    }
  }
}
