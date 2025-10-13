/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendPasswordResetEmail(email: string, token: string) {
    // Frontend URL - nên đặt trong .env
    const resetUrl = this.configService.get<string>('RESET_URL');
    const fullResetUrl = `${resetUrl}?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset Your CineMate Password',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>CineMate Password Reset</h2>
          <p>Hey,</p>
          <p>Please click the button below to reset your password:</p>
          <a href="${fullResetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Reset Password</a>
          <p>Or copy and paste this link: ${fullResetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error; // Re-throw để auth service có thể handle
    }
  }
}
