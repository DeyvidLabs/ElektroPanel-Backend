// src/mail/mail.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CookieOptions } from 'express';
import * as jwt from 'jsonwebtoken';
import { User } from '../database/user.entity';
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailSecret = process.env.EMAIL_TOKEN_SECRET || 'email_token_secret';
  private readonly emailTokenExpiration = '1h';

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g., mail.yourdomain.com
      port: Number(process.env.SMTP_PORT), // 587 or 465
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      const info = await this.transporter.sendMail({
        from: `${process.env.SMTP_FROM}`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      throw err;
    }
  }

  async generateVerificationToken(user: User) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      this.emailSecret,
      { expiresIn: this.emailTokenExpiration },
    );
  }

  async verifyToken(token: string) {
    try {
      return jwt.verify(token, this.emailSecret) as {
        userId: string;
        email: string;
      };
    } catch (err) {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  /*
    Mail change
  */

  async generateEmailToken(user: User, newEmail: string) {
    return jwt.sign(
      { userId: user.id, email: user.email, newEmail: newEmail },
      this.emailSecret,
      { expiresIn: this.emailTokenExpiration },
    );
  }

  async verfiyEmailtoken(token: string) {
    try {
      return jwt.verify(token, this.emailSecret) as {
        userId: string;
        email: string;
        newEmail: string;
      };
    } catch (err) {
      throw new BadRequestException('Invalid or expired token');
    }
  }



  async sendDeletionEmail(email: string, userId: string) {
    const token = await this.generateVerificationToken({ id: userId, email } as User);
    const deleteUrl = `${process.env.BACKEND_URL}/auth/delete-account?token=${token}`;

    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <h1 style="text-align: center; color: #c0392b;">Confirm Account Deletion</h1>
        <p style="font-size: 16px;">You requested to delete your ElektroPanel account. This action is irreversible.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${deleteUrl}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Delete My Account
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">If you didn’t request this, please ignore this email.</p>
        <p style="word-break: break-all;"><a href="${deleteUrl}" style="color: #3498db;">${deleteUrl}</a></p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <footer style="font-size: 12px; color: #888; text-align: center;">
          This link is valid for a limited time and can be used only once.
        </footer>
      </div>
    `;

    await this.sendMail({
      to: email,
      subject: 'Confirm Account Deletion',
      html,
      text: `Delete your account by visiting: ${deleteUrl}`,
    });
  }

  async sendMailChange(email: string, userId: string, newEmail: string) {
    const token = await this.generateEmailToken({ id: userId, email: email } as User, newEmail);
    const emailChangeUrl = `${process.env.BACKEND_URL}/auth/change-email?token=${token}`;

    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <h1 style="text-align: center; color: #2980b9;">Confirm Email Change</h1>
        <p style="font-size: 16px;">
          A request was made to change the email address associated with your ElektroPanel account.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${emailChangeUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Confirm Email Change
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
        <p style="word-break: break-all;"><a href="${emailChangeUrl}" style="color: #3498db;">${emailChangeUrl}</a></p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <footer style="font-size: 12px; color: #888; text-align: center;">
          This link is valid for a limited time and can be used only once.
        </footer>
      </div>

    `;

    await this.sendMail({
      to: newEmail,
      subject: 'Mail change request',
      html,
      text: `Change your email by visiting: ${emailChangeUrl}`,
    });
  }

  async sendActivationEmail(user: User) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <h1 style="text-align: center; color: #27ae60;">Welcome to ElektroPanel 🎉</h1>
        <p style="font-size: 16px;">
          Hi ${user.name},<br/><br/>
          Your account has just been activated and you're now able to access the platform.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">
          If you did not expect this email, you can ignore it or contact our support.
        </p>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <footer style="font-size: 12px; color: #888; text-align: center;">
          You are receiving this because your account was recently approved by an administrator.
        </footer>
      </div>
    `;

    await this.sendMail({
      to: user.email,
      subject: 'Your ElektroPanel Account Has Been Activated!',
      html,
      text: `Hi ${user.name}, your account has been activated. Visit ${process.env.FRONTEND_URL} to log in.`,
    });
  }




}
