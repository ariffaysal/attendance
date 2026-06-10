export interface AttendanceRecord {
  status: string;
  empNo: string;
  acNo: string;
  no: string;
  name: string;
  autoAssign: string;
  date: string;
  timetable: string;
  onDuty: string;
  offDuty: string;
  clockIn: string;
  clockOut: string;
  normal: string;
  realTime: string;
  late: string;
  early: string;
  absent: string;
  otTime: string;
  workTime: string;
  exception: string;
  mustCIn: string;
  mustCOut: string;
  department: string;
  nDays: string;
  weekEnd: string;
  holiday: string;
  attTime: string;
  nDaysOt: string;
  weekEndOt: string;
  holidayOt: string;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
}

export interface SearchParams {
  searchQuery: string;
  searchType: 'general' | 'emp_no' | 'acc_no';
  fromDate: string;
  toDate: string;
}

export interface PaginationData<T> {
  records: T[];
  total: number;
  currentPage: number;
  totalPages: number;
  perPage: number;
}

export interface JobCardSummary {
  totalDays: number;
  weekend: number;
  workingDays: number;
  absent: number;
  present: number;
  late: number;
  earlyOut: number;
  payableDays: number;
}

export interface JobCardEmployee {
  // CSV 4 identity columns from csv_employees table
  empNo: string;    // `Emp No.` from CSV
  acNo: string;     // `AC-No.` from CSV
  no: string;       // `No.` from CSV
  name: string;     // `Name` from CSV
  dept: string;
  summary: JobCardSummary;
  records: JobCardDailyRecord[];
}

export interface JobCardDailyRecord {
  date: string;
  day: string;
  inTime: string;
  outTime: string;
  late: string;
  status: string;
  isFriday: boolean;
  isPresent: boolean;
}

export interface MonthlyEmployee {
  // CSV 4 identity columns from csv_employees table
  empNo: string;    // `Emp No.` from CSV
  acNo: string;     // `AC-No.` from CSV
  no: string;       // `No.` from CSV
  name: string;     // `Name` from CSV
  records: MonthlyDailyRecord[];
  present: number;
  absent: number;
  late: number;
}

export interface MonthlyDailyRecord {
  day: number;
  status: string;
  in: string;
  out: string;
  ot: string;
  late: string;
}

// Salary Attendance with calculated late/absent and policy deductions
export interface SalaryAttendance {
  empNo: string;
  empName: string;
  daysInMonth: number;
  payDays: number;
  presentDays: number;
  lateDays: number;
  lateDeductionDays: number;      // 6 late = 1 absent
  lateDeductionAmount: number;    // Calculated late deduction amount
  absentDays: number;
  actualAbsent: number;           // absent + late deduction
  fridayHolidays: number;
  weekends: number;
  grossSalary: number;
  basicSalary: number;
  lateDeductionPolicy: string;    // APPLICABLE / NOT_APPLICABLE / N/A
  absentDeductionPolicy: string;  // ON_GROSS / ON_BASIC / N/A
  absentDeductionAmount: number;  // Calculated deduction amount
}
