import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import * as crypto from 'crypto';
import { SQL_CONNECTION } from '../../database/database.module';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(SQL_CONNECTION)
    private connection: mysql.Connection,
  ) {}

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async findAll() {
    const [users] = await this.connection.execute(
      'SELECT id, employee_id, email, mobile_number, is_active, role, last_login, created_at, updated_at FROM auth_users ORDER BY created_at DESC'
    );

    return (users as any[]).map(user => ({
      id: user.id,
      employeeId: user.employee_id,
      email: user.email,
      mobileNumber: user.mobile_number,
      isActive: Boolean(user.is_active),
      lastLogin: user.last_login,
      createdAt: user.created_at,
      role: user.role,
    }));
  }

  async findOne(id: number) {
    const [users] = await this.connection.execute(
      'SELECT id, employee_id, email, mobile_number, is_active, role, last_login, created_at, updated_at FROM auth_users WHERE id = ?',
      [id]
    );

    const user = (users as any[])[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      employeeId: user.employee_id,
      email: user.email,
      mobileNumber: user.mobile_number,
      isActive: Boolean(user.is_active),
      role: user.role,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async create(createUserDto: CreateUserDto) {
    const { employeeId, email, mobileNumber, password, isActive, role } = createUserDto;

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
    const [result] = await this.connection.execute(
      'INSERT INTO auth_users (employee_id, email, mobile_number, password_hash, is_active, role) VALUES (?, ?, ?, ?, ?, ?)',

      [employeeId, email, mobileNumber || null, passwordHash, isActive !== false, role || null],
    );

    const insertId = (result as mysql.OkPacket).insertId;

    return {
      success: true,
      message: 'User created successfully',
      userId: insertId,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const { employeeId, email, mobileNumber, password, isActive, role } = updateUserDto;

    // Check if user exists
    const [existingUsers] = await this.connection.execute(
      'SELECT id, employee_id, email FROM auth_users WHERE id = ?',
      [id]
    );

    if ((existingUsers as any[]).length === 0) {
      throw new NotFoundException('User not found');
    }

    const existingUser = (existingUsers as any[])[0];

    // Check if employee_id is being changed and already exists
    if (employeeId && employeeId !== existingUser.employee_id) {
      const [existingEmployee] = await this.connection.execute(
        'SELECT id FROM auth_users WHERE employee_id = ? AND id != ?',
        [employeeId, id],
      );

      if ((existingEmployee as any[]).length > 0) {
        throw new ConflictException('Employee ID already registered');
      }
    }

    // Check if email is being changed and already exists
    if (email && email !== existingUser.email) {
      const [existingEmailUser] = await this.connection.execute(
        'SELECT id FROM auth_users WHERE email = ? AND id != ?',
        [email, id],
      );

      if ((existingEmailUser as any[]).length > 0) {
        throw new ConflictException('Email already registered');
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (employeeId !== undefined) {
      updates.push('employee_id = ?');
      values.push(employeeId);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (mobileNumber !== undefined) {
      updates.push('mobile_number = ?');
      values.push(mobileNumber || null);
    }

    if (password !== undefined) {
      updates.push('password_hash = ?');
      values.push(this.hashPassword(password));
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }

    // Handle role update (optional)
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return {
        success: true,
        message: 'No changes to update',
      };
    }

    values.push(id);

    await this.connection.execute(
      `UPDATE auth_users SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );

    return {
      success: true,
      message: 'User updated successfully',
    };
  }

  async remove(id: number) {
    // Check if user exists
    const [existingUsers] = await this.connection.execute(
      'SELECT id FROM auth_users WHERE id = ?',
      [id]
    );

    if ((existingUsers as any[]).length === 0) {
      throw new NotFoundException('User not found');
    }

    await this.connection.execute(
      'DELETE FROM auth_users WHERE id = ?',
      [id]
    );

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
