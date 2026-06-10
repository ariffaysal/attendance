import { IsString, IsOptional } from 'class-validator';

export class CreateEmployeeEducationDto {
  // CSV 4 Identity Columns (from frontend)
  @IsString()
  @IsOptional()
  empNo?: string;    // Emp No. from CSV

  @IsString()
  @IsOptional()
  acNo?: string;     // AC-No. from CSV

  @IsString()
  @IsOptional()
  no?: string;       // No. from CSV

  @IsString()
  @IsOptional()
  name?: string;     // Name from CSV

  // Top Section - Employee Information (legacy)
  @IsString()
  empCode: string;

  @IsString()
  @IsOptional()
  empId?: string;

  @IsString()
  @IsOptional()
  empName?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  division?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  section?: string;

  @IsString()
  @IsOptional()
  subsection?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  // Middle Section - Education Details
  @IsString()
  @IsOptional()
  courseName?: string;

  @IsString()
  @IsOptional()
  board?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  discipline?: string;

  @IsString()
  @IsOptional()
  majorSubject?: string;

  @IsString()
  @IsOptional()
  year?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsString()
  @IsOptional()
  educationNature?: string;
}

export class UpdateEmployeeEducationDto extends CreateEmployeeEducationDto {}
