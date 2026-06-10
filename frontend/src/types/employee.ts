export interface Employee {
  id: number;
  // CSV 4 Identity Columns (from csv_employees table - source of truth)
  empNo: string;    // `Emp No.` from CSV
  acNo: string;     // `AC-No.` from CSV
  no: string;       // `No.` from CSV (like E0453)
  name: string;     // `Name` from CSV
  // Legacy fields (mapped from CSV columns for backward compatibility)
  emp_code: string;  // Maps to `No.`
  emp_id: string;    // Maps to `Emp No.`
  punch_card: string; // Maps to `AC-No.`
  full_name_bangla: string;  // Maps to `Name`
  full_name_english: string; // Maps to `Name`
  fathers_name_bangla?: string;
  fathers_name?: string;
  mothers_name_bangla?: string;
  mothers_name?: string;
  spouse_name_bangla?: string;
  spouse_name?: string;
  blood_group?: string;
  gender?: string;
  birth_place?: string;
  date_of_birth?: string;
  age?: string;
  religion?: string;
  marital_status?: string;
  nationality?: string;
  national_id: string;
  mobile_no: string;
  category: string;
  company: string;
  location: string;
  division?: string;
  department: string;
  section?: string;
  subsection?: string;
  designation_level?: string;
  designation: string;
  functional_superior?: string;
  leave_app_process_use: string;
  leave_approving_authority: string;
  admin_superior?: string;
  joining_date: string;
  provisional_tenor: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export type CreateEmployeeData = Omit<Employee, 'id' | 'created_at' | 'updated_at'>;
export type UpdateEmployeeData = Partial<CreateEmployeeData>;
