import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('email.host'),
      port: this.config.get<number>('email.port'),
      auth: {
        user: this.config.get<string>('email.user'),
        pass: this.config.get<string>('email.pass'),
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const clientUrl = this.config.get<string>('client.url');
    const url = `${clientUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get<string>('email.from'),
      to,
      subject: 'Verify your PROFYLE account',
      html: `
        <h2>Welcome to PROFYLE!</h2>
        <p>Click the link below to verify your email address:</p>
        <a href="${url}" style="padding: 12px 24px; background: #2563eb; color: white; border-radius: 6px; text-decoration: none;">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create a PROFYLE account, you can ignore this email.</p>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const clientUrl = this.config.get<string>('client.url');
    const url = `${clientUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get<string>('email.from'),
      to,
      subject: 'Reset your PROFYLE password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${url}" style="padding: 12px 24px; background: #2563eb; color: white; border-radius: 6px; text-decoration: none;">
          Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }
}
