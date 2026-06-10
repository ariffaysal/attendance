import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class EvaluateRuleDto {
  @IsNumber()
  rule_id: number;

  @IsObject()
  employee_context: {
    emp_code: string;
    department?: string;
    designation?: string;
    category?: string;
    years_of_service?: number;
    joining_date?: string;
    basic_salary?: number;
    [key: string]: any;
  };
}

export class TestRuleConditionDto {
  @IsNumber()
  rule_id: number;

  @IsObject()
  test_data: Record<string, any>;

  @IsString()
  @IsOptional()
  test_name?: string;
}

export class RuleEvaluationResult {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  matched: boolean;
  matched_conditions: string[];
  failed_conditions: string[];
  calculated_value?: number;
  execution_time_ms: number;
  errors?: string[];
}

export class BatchEvaluationDto {
  @IsNumber()
  policy_id: number;

  @IsObject()
  employee_context: Record<string, any>;
}
