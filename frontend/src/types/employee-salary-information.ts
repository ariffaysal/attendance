export interface BankInfo {
  id?: number;
  // CSV columns
  empNo?: string;
  acNo?: string;
  no?: string;
  name?: string;
  // Legacy
  empCode?: string;
  salaryBank: string;
  branchName: string;
  accountNo: string;
  salaryAmount: string;
  salaryPeriod: string;
  showTax: string;
  sequence: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryBreakdown {
  id?: number;
  // CSV columns
  empNo?: string;
  acNo?: string;
  no?: string;
  name?: string;
  // Legacy
  empCode?: string;
  payrollHead: string;
  type: string;
  percentageFormula: string;
  baseHead: string;
  amount: string;
  sequence: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeSalaryInformation {
  joinDate: string;
  id?: number;
  
  // CSV 4 columns (new standard)
  empNo?: string;    // `Emp No.` from CSV
  acNo?: string;     // `AC-No.` from CSV - PRIMARY key
  no?: string;       // `No.` from CSV
  name?: string;     // `Name` from CSV
  
  // Employee Details (legacy - for backward compatibility)
  empCode: string;   // Maps to `No.`
  empId: string;   // Maps to `Emp No.`
  empName: string; // Maps to `Name`
  category: string;
  company: string;
  location: string;
  division: string;
  department: string;
  section: string;
  subsection: string;
  designation: string;
  
  // Salary Information
  sGrade: string;
  stSalary: string;
  grossSalary: string;
  bGross: string;
  cashDisbursement: string;
  policy: string;
  mode: string;
  
  // Salary Summary
  totalAdditions?: string;
  totalDeductions?: string;
  netPayable?: string;
  
  // Bank Information
  bankInfos?: BankInfo[];
  
  // Salary Breakdown
  salaryBreakdown?: SalaryBreakdown[];
  
  createdAt?: string;
  updatedAt?: string;
}

export type CreateEmployeeSalaryInformationData = Omit<EmployeeSalaryInformation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmployeeSalaryInformationData = Partial<CreateEmployeeSalaryInformationData>;
