import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, MaxLength } from 'class-validator';

export class CreatePolicyAssignmentDto {
  @IsString()
  @MaxLength(50)
  emp_code: string;

  @IsNumber()
  policy_id: number;

  @IsNumber()
  rule_id: number;

  @IsDateString()
  assigned_date: string;

  @IsDateString()
  @IsOptional()
  effective_date?: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  assigned_by?: string;

  @IsBoolean()
  @IsOptional()
  is_override?: boolean = false;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePolicyAssignmentDto {
  @IsNumber()
  @IsOptional()
  rule_id?: number;

  @IsDateString()
  @IsOptional()
  effective_date?: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_override?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkAssignDto {
  @IsNumber()
  policy_id: number;

  @IsNumber()
  rule_id: number;

  @IsOptional()
  filter_criteria: {
    departments?: string[];
    designations?: string[];
    categories?: string[];
    emp_codes?: string[];
  };

  @IsDateString()
  @IsOptional()
  effective_date?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class EmployeePolicyQueryDto {
  @IsString()
  @IsOptional()
  emp_code?: string;

  @IsNumber()
  @IsOptional()
  policy_id?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  status?: 'Active' | 'Pending' | 'Expired';
}
