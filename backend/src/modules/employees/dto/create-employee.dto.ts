import { IsString, IsOptional } from 'class-validator';

export class CreateEmployeeDto {
  // CSV 4 Columns - READ ONLY from csv_employees table
  // emp_code maps to `No.`, emp_id maps to `Emp No.`, punch_card maps to `AC-No.`
  // These are looked up from CSV upload, not entered manually
  @IsString()
  @IsOptional()
  emp_code?: string;  // Maps to `No.` - READ ONLY from CSV

  @IsString()
  @IsOptional()
  emp_id?: string;   // Maps to `Emp No.` - READ ONLY from CSV

  @IsString()
  @IsOptional()
  punch_card?: string; // Maps to `AC-No.` - READ ONLY from CSV

  // Name comes from CSV `Name` column - READ ONLY
  @IsString()
  @IsOptional()
  full_name_bangla?: string;

  @IsString()
  @IsOptional()
  full_name_english?: string;

  @IsString()
  @IsOptional()
  fathers_name_bangla?: string;

  @IsString()
  @IsOptional()
  fathers_name?: string;

  @IsString()
  @IsOptional()
  mothers_name_bangla?: string;

  @IsString()
  @IsOptional()
  mothers_name?: string;

  @IsString()
  @IsOptional()
  spouse_name_bangla?: string;

  @IsString()
  @IsOptional()
  spouse_name?: string;

  @IsString()
  @IsOptional()
  blood_group?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  birth_place?: string;

  @IsString()
  @IsOptional()
  date_of_birth?: string;

  @IsString()
  @IsOptional()
  age?: string;

  @IsString()
  @IsOptional()
  religion?: string;

  @IsString()
  @IsOptional()
  marital_status?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  national_id: string;

  @IsString()
  mobile_no: string;

  @IsString()
  category: string;

  @IsString()
  company: string;

  @IsString()
  location: string;

  @IsString()
  @IsOptional()
  division?: string;

  @IsString()
  department: string;

  @IsString()
  @IsOptional()
  section?: string;

  @IsString()
  @IsOptional()
  subsection?: string;

  @IsString()
  @IsOptional()
  designation_level?: string;

  @IsString()
  designation: string;

  @IsString()
  @IsOptional()
  functional_superior?: string;

  @IsString()
  leave_app_process_use: string;

  @IsString()
  leave_approving_authority: string;

  @IsString()
  @IsOptional()
  admin_superior?: string;

  @IsString()
  joining_date: string;

  @IsString()
  provisional_tenor: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}
