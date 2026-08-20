import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
    const resendKey = this.config.get<string>('resend.apiKey')?.trim();
    const from =
      this.config.get<string>('resend.from') ??
      this.config.get<string>('smtp.from') ??
      'no-reply@prospectly.dev';

    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        if (error) {
          this.logger.error(`Resend failed for ${message.to}: ${error.message}`);
          throw new ServiceUnavailableException(`Failed to send email via Resend: ${error.message}`);
        }
      } catch (err) {
        this.logger.error(`Resend send threw for ${message.to}`, err);
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        throw new ServiceUnavailableException('Failed to send email via Resend');
      }
      return;
    }

    const host = this.config.get<string>('smtp.host')?.trim();
    if (!host) {
      if (this.isProdLike()) {
        this.logger.error(
          `Mail provider not configured — cannot send email to ${message.to} (token not logged)`,
        );
        throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
      }
      this.logger.log(
        `Mail not configured — email queued for ${message.to} (token not logged)`,
      );
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
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (err) {
      this.logger.error(`SMTP send failed for ${message.to}`, err);
      throw new ServiceUnavailableException('Failed to send email via SMTP');
    }
  }
}
