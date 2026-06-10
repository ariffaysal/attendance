import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly useMock: boolean;

  constructor(private readonly configService: ConfigService) {
    this.useMock = this.configService.get<string>('USE_MOCK_EMAIL') !== 'false';
    
    if (this.useMock) {
      this.logger.log('Email Service running in MOCK mode - emails will be logged to console');
      this.logger.log('Set USE_MOCK_EMAIL=false in .env to use real Gmail SMTP');
    }
  }

  /**
   * Send email
   * In mock mode, logs to console instead of sending
   * In production, uses Gmail SMTP
   */
  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.useMock) {
      // Mock mode - log to console and return success
      this.logger.log('========================================');
      this.logger.log('📧 MOCK EMAIL SENT');
      this.logger.log(`To: ${message.to}`);
      this.logger.log(`Subject: ${message.subject}`);
      this.logger.log(`Body: ${message.text}`);
      this.logger.log('========================================');
      
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }

    // Real email sending using Gmail SMTP
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.configService.get<string>('GMAIL_USER'),
          pass: this.configService.get<string>('GMAIL_APP_PASSWORD'),
        },
      });

      const result = await transporter.sendMail({
        from: `"Skyview Attendance" <${this.configService.get<string>('GMAIL_USER')}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send email:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send password reset verification code via email
   */
  async sendPasswordResetCode(email: string, code: string, employeeId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = 'Skyview Password Reset Verification Code';
    
    const text = `Hello,

You requested a password reset for your Skyview account (Employee ID: ${employeeId}).

Your verification code is: ${code}

This code expires in 10 minutes.

If you didn't request this, please ignore this email.

---
Skyview Attendance System`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #00f0ff, #a855f7); padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .code { font-size: 32px; font-weight: bold; color: #00f0ff; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You requested a password reset for your <strong>Skyview</strong> account.</p>
      
      <div class="code">${code}</div>
      
      <div class="warning">
        ⏱️ This code expires in <strong>10 minutes</strong>
      </div>
      
      <p><strong>Employee ID:</strong> ${employeeId}</p>
      
      <p style="color: #6b7280; font-size: 14px;">
        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
      </p>
    </div>
    <div class="footer">
      <p>Skyview Attendance System<br>© 2024 Skyview. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }

  /**
   * Generate 6-digit random verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
