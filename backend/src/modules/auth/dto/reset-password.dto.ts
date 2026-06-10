import { IsString, IsNotEmpty, MinLength, MaxLength, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
