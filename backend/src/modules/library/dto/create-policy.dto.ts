import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength, MinLength } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  policy_code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  policy_name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

  @IsBoolean()
  @IsOptional()
  is_template?: boolean = false;
}

export class UpdatePolicyDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  policy_code?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  policy_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
