import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsMessage {
  to: string;
  body: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly useMock: boolean;

  constructor(private readonly configService: ConfigService) {
    this.useMock = this.configService.get<string>('USE_MOCK_SMS') !== 'false';
    
    if (this.useMock) {
      this.logger.log('SMS Service running in MOCK mode - codes will be logged to console');
      this.logger.log('Set USE_MOCK_SMS=false in .env to use real Twilio SMS');
    }
  }

  /**
   * Send SMS message
   * In mock mode, logs to console instead of sending
   * In production, integrate with Twilio or other SMS provider
   */
  async sendSms(message: SmsMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Format phone number (ensure it has country code)
    const formattedNumber = this.formatPhoneNumber(message.to);

    if (this.useMock) {
      // Mock mode - log to console and return success
      this.logger.log('========================================');
      this.logger.log('📱 MOCK SMS SENT');
      this.logger.log(`To: ${formattedNumber}`);
      this.logger.log(`Body: ${message.body}`);
      this.logger.log('========================================');
      
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }

    // Real SMS sending - Twilio integration example
    // Uncomment and configure when ready for production
    /*
    try {
      const twilio = require('twilio');
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      
      const client = twilio(accountSid, authToken);
      
      const result = await client.messages.create({
        body: message.body,
        from: fromNumber,
        to: formattedNumber,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send SMS:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
    */

    // For now, if not using mock but also not configured, return error
    return {
      success: false,
      error: 'SMS provider not configured. Set USE_MOCK_SMS=true for development.',
    };
  }

  /**
   * Send password reset verification code
   */
  async sendPasswordResetCode(phoneNumber: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message: SmsMessage = {
      to: phoneNumber,
      body: `Your Skyview password reset code is: ${code}. This code expires in 10 minutes. Do not share this code with anyone.`,
    };

    return this.sendSms(message);
  }

  /**
   * Format phone number to E.164 format
   * Assumes Bangladesh numbers if no country code provided
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If no country code, assume Bangladesh (+880)
    if (cleaned.length === 10 && cleaned.startsWith('1')) {
      cleaned = '880' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('01')) {
      cleaned = '880' + cleaned.substring(1);
    }

    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Generate 6-digit random verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
