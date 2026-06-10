import { IsString, IsOptional, IsBoolean, IsJSON, IsNumber, IsEnum, MaxLength, MinLength } from 'class-validator';

export class CreateRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  rule_code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  rule_name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  conditions?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  calculation_formula?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

}

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  rule_code?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  rule_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  conditions?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  calculation_formula?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

}
