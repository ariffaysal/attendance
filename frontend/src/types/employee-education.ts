export interface EmployeeEducation {
  id?: number;
  
  // CSV 4 columns (new standard)
  empNo?: string;    // `Emp No.` from CSV
  acNo?: string;     // `AC-No.` from CSV - PRIMARY key
  no?: string;       // `No.` from CSV
  name?: string;     // `Name` from CSV
  
  // Top Section - Employee Information (legacy - backward compatibility)
  empCode: string;   // Maps to `No.`
  empId: string;     // Maps to `Emp No.`
  empName: string;   // Maps to `Name`
  category: string;
  company: string;
  location: string;
  division: string;
  department: string;
  section: string;
  subsection: string;
  designation: string;
  
  // Middle Section - Education Details
  courseName: string;
  board: string;
  institution: string;
  discipline: string;
  majorSubject: string;
  year: string;
  result: string;
  educationNature: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export type CreateEmployeeEducationData = Omit<EmployeeEducation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmployeeEducationData = Partial<CreateEmployeeEducationData>;
