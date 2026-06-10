import { IsString, IsEmail, IsOptional, IsBoolean, MinLength, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @Transform(({ value }) => value === 'true' || value === true || value === '1' || value === 1)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(['admin', 'staff', 'hr'])
  @IsOptional()
  role?: 'admin' | 'staff' | 'hr';
}
