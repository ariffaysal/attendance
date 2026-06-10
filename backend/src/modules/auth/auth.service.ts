import { Injectable, Inject, ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import * as crypto from 'crypto';
import { SQL_CONNECTION } from '../../database/database.module';
import { EmailService } from '../../common/services/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SQL_CONNECTION)
    private connection: mysql.Connection,
    private readonly emailService: EmailService,
  ) {}

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async register(registerDto: RegisterDto) {
    const { employeeId, email, mobileNumber, password } = registerDto;

    // Check if employee_id already exists
    const [existingEmployee] = await this.connection.execute(
      'SELECT id FROM auth_users WHERE employee_id = ?',
      [employeeId],
    );

    if ((existingEmployee as any[]).length > 0) {
      throw new ConflictException('Employee ID already registered');
    }

    // Check if email already exists
    const [existingEmail] = await this.connection.execute(
      'SELECT id FROM auth_users WHERE email = ?',
      [email],
    );

    if ((existingEmail as any[]).length > 0) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = this.hashPassword(password);

    // Insert new user
    await this.connection.execute(
      'INSERT INTO auth_users (employee_id, email, mobile_number, password_hash) VALUES (?, ?, ?, ?)',
      [employeeId, email, mobileNumber, passwordHash],
    );

    return {
      success: true,
      message: 'Account created successfully',
    };
  }

  async login(loginDto: LoginDto) {
    const { employeeId, password } = loginDto;

    // Find user by employee_id
    const [users] = await this.connection.execute(
      'SELECT id, employee_id, email, mobile_number, role, password_hash, is_active FROM auth_users WHERE employee_id = ?',
      [employeeId],
    );

    const user = (users as any[])[0];

    if (!user) {
      throw new UnauthorizedException('Invalid employee ID or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const passwordHash = this.hashPassword(password);
    if (passwordHash !== user.password_hash) {
      throw new UnauthorizedException('Invalid employee ID or password');
    }

    // Update last login
    await this.connection.execute(
      'UPDATE auth_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id],
    );

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        employeeId: user.employee_id,
        email: user.email,
        mobileNumber: user.mobile_number,
        role: user.role || 'staff',
      },
    };
  }

  async validateUser(employeeId: string) {
    const [users] = await this.connection.execute(
      'SELECT id, employee_id, email, mobile_number, role, is_active FROM auth_users WHERE employee_id = ?',
      [employeeId],
    );

    const user = (users as any[])[0];

    if (!user || !user.is_active) {
      return null;
    }

    return {
      id: user.id,
      employeeId: user.employee_id,
      email: user.email,
      mobileNumber: user.mobile_number,
      role: user.role || 'staff',
    };
  }

  /**
   * Initiate password reset - send verification code to email
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { employeeId } = forgotPasswordDto;

    // Find user by employee_id
    const [users] = await this.connection.execute(
      'SELECT id, employee_id, email, is_active FROM auth_users WHERE employee_id = ?',
      [employeeId],
    );

    const user = (users as any[])[0];

    if (!user) {
      throw new NotFoundException('Employee ID not found');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Generate 6-digit verification code
    const resetCode = this.emailService.generateVerificationCode();

    // Set expiration time (10 minutes from now)
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Save code and expiration to database
    await this.connection.execute(
      'UPDATE auth_users SET reset_code = ?, reset_code_expires = ?, is_reset_verified = 0 WHERE id = ?',
      [resetCode, resetCodeExpires, user.id],
    );

    // Send email with verification code
    const emailResult = await this.emailService.sendPasswordResetCode(
      user.email,
      resetCode,
      user.employee_id,
    );

    if (!emailResult.success) {
      throw new BadRequestException(`Failed to send verification code: ${emailResult.error}`);
    }

    // Mask email for response (e.g., j***@example.com)
    const maskedEmail = this.maskEmail(user.email);

    return {
      success: true,
      message: 'Verification code sent to your email address',
      maskedEmail: maskedEmail,
    };
  }

  /**
   * Verify the reset code
   */
  async verifyCode(verifyCodeDto: VerifyCodeDto) {
    const { employeeId, code } = verifyCodeDto;

    // Find user with valid reset code
    const [users] = await this.connection.execute(
      'SELECT id, reset_code, reset_code_expires FROM auth_users WHERE employee_id = ? AND reset_code = ?',
      [employeeId, code],
    );

    const user = (users as any[])[0];

    if (!user) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Check if code has expired
    const now = new Date();
    const expiresAt = new Date(user.reset_code_expires);

    if (now > expiresAt) {
      throw new UnauthorizedException('Verification code has expired. Please request a new one.');
    }

    // Mark code as verified
    await this.connection.execute(
      'UPDATE auth_users SET is_reset_verified = 1 WHERE id = ?',
      [user.id],
    );

    return {
      success: true,
      message: 'Verification code confirmed. You can now reset your password.',
    };
  }

  /**
   * Reset password after verification
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { employeeId, newPassword, code } = resetPasswordDto;

    // Find user with verified reset code
    const [users] = await this.connection.execute(
      'SELECT id, reset_code, reset_code_expires, is_reset_verified FROM auth_users WHERE employee_id = ? AND reset_code = ?',
      [employeeId, code],
    );

    const user = (users as any[])[0];

    if (!user) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Check if code has expired
    const now = new Date();
    const expiresAt = new Date(user.reset_code_expires);

    if (now > expiresAt) {
      throw new UnauthorizedException('Verification code has expired. Please request a new one.');
    }

    // Check if code has been verified
    if (!user.is_reset_verified) {
      throw new UnauthorizedException('Verification code not confirmed. Please verify the code first.');
    }

    // Hash new password
    const passwordHash = this.hashPassword(newPassword);

    // Update password and clear reset fields
    await this.connection.execute(
      'UPDATE auth_users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL, is_reset_verified = 0 WHERE id = ?',
      [passwordHash, user.id],
    );

    return {
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    };
  }

  /**
   * Mask email for privacy (e.g., john.doe@example.com -> j***@example.com)
   */
  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return '****';
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    if (localPart.length <= 2) {
      return '*'.repeat(localPart.length) + domain;
    }

    // Show first 1 char and mask the rest before @
    const firstChar = localPart.charAt(0);
    const maskedLocal = '*'.repeat(localPart.length - 1);

    return firstChar + maskedLocal + domain;
  }
}
