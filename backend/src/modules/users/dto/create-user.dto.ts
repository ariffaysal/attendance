import { IsString, IsEmail, IsOptional, IsBoolean, MinLength, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  employeeId: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @Transform(({ value }) => value === 'true' || value === true || value === '1' || value === 1)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(['admin', 'staff', 'hr'])
  @IsOptional()
  role?: 'admin' | 'staff' | 'hr';
}
