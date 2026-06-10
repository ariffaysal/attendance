'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { attendanceService, SearchParams } from '@/services/attendance.service';
import { employeeSalaryInformationService } from '@/services/employee-salary-information.service';
import { employeePolicyTaggingService } from '@/services/employee-policy-tagging.service';
import { api, unwrapResponse } from '@/services/api';
import { EmployeeSalaryInformation, SalaryBreakdown, BankInfo } from '@/types/employee-salary-information';
import { SearchBar } from '@/components/dashboard/SearchBar';

interface SalaryComponent {
  basic: number;
  houseRent: number;
  medical: number;
  transport: number;
  conveyance: number;
  gross: number;
}

interface AttendanceDetail {
  daysInMonth: number;
  payDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  fridayHolidays: number;
  weekends: number;
  cl: number;
  sl: number;
  ml: number;
  el: number;
}

interface Deduction {
  absentAmount: number;
  lateDeduction: number;
  leaveAmount: number;
  totalDeduction: number;
  netPay: number;
}

interface Overtime {
  hours: number;
  rate: number;
  amount: number;
}

interface SalarySheetEmployee {
  // CSV 4 columns
  empNo: string;    // `Emp No.` from CSV
  acNo: string;     // `AC-No.` from CSV - PRIMARY key
  no: string;       // `No.` from CSV
  name: string;     // `Name` from CSV
  designation: string;
  joinDate: string;
  grade: string;
  resignDate: string;
  salary: SalaryComponent;
  attendance: AttendanceDetail;
  deduction: Deduction;
  overtime: Overtime;
  totalWages: number;
  totalAdditions: number;
  advance: number;
  tax: number;
  stamp: number;
  netPayable: number;
  inBank: number;
  inCash: number;
  bankInfo?: BankInfo;
}

// Dynamic column width calculator based on text length
const getColWidth = (text: string, minWidth: number = 35, maxWidth: number = 200, pxPerChar: number = 7): number => {
  const length = text.length;
  const calculated = Math.max(minWidth, length * pxPerChar + 16); // +16 for padding
  return Math.min(calculated, maxWidth);
};

// Column definitions with their labels, sizes, and font sizes (in px)
// Edit fontSize below to manually control text size for each column
const columnDefs = {
  // General Info
  idCard: { label: 'ID Card', min: 40, max: 50, fontSize: 9 },
  employeeName: { label: 'Name', min: 120, max: 220, fontSize: 9 },
  designation: { label: 'Designation', min: 300, max: 300, fontSize: 9 },
  joinDate: { label: 'Join Date', min: 70, max: 100, fontSize: 9 },
  grade: { label: 'Grade', min: 15, max: 15, fontSize: 9 },
  // Salary
  basic: { label: 'Basic', min: 55, max: 70, fontSize: 9 },
  houseRent: { label: 'House Rent', min: 70, max: 95, fontSize: 9 },
  medical: { label: 'Medical', min: 50, max: 70, fontSize: 9 },
  transport: { label: 'Transport', min: 65, max: 90, fontSize: 9 },
  food: { label: 'Food', min: 45, max: 60, fontSize: 9 },
  gross: { label: 'Gross Salary', min: 600, max: 650, fontSize: 10 },
  // Attendance
  days: { label: 'Days', min: 35, max: 50, fontSize: 9 },
  payDays: { label: 'Pay Days', min: 45, max: 70, fontSize: 9 },
  present: { label: 'Present', min: 40, max: 60, fontSize: 9 },
  late: { label: 'Late', min: 30, max: 50, fontSize: 9 },
  absent: { label: 'Absent', min: 35, max: 55, fontSize: 9 },
  fh: { label: 'F.H.', min: 30, max: 45, fontSize: 9 },
  we: { label: 'W.E.', min: 30, max: 45, fontSize: 9 },
  cl: { label: 'CL', min: 25, max: 40, fontSize: 9 },
  sl: { label: 'SL', min: 25, max: 40, fontSize: 9 },
  ml: { label: 'ML', min: 25, max: 40, fontSize: 9 },
  el: { label: 'EL', min: 25, max: 40, fontSize: 9 },
  // Deduction
  absentAmt: { label: 'Absent Amt', min: 55, max: 80, fontSize: 9 },
  lateDed: { label: 'Late Deduct', min: 60, max: 85, fontSize: 9 },
  leaveAmt: { label: 'Leave Amt', min: 50, max: 75, fontSize: 9 },
  totalDed: { label: 'Total Late Deduction', min: 85, max: 110, fontSize: 9 },
  netPay: { label: 'Net Pay', min: 55, max: 80, fontSize: 9 },
  // Final
  netPayable: { label: 'Net Payable', min: 70, max: 100, fontSize: 10 },
  inBank: { label: 'In Bank', min: 60, max: 85, fontSize: 9 },
  inCash: { label: 'In Cash', min: 60, max: 85, fontSize: 9 },
  sign: { label: 'Sign', min: 45, max: 60, fontSize: 10 },
};

export default function SalarySheetPage() {
  const searchParams = useSearchParams();
  const [salaryData, setSalaryData] = useState<SalarySheetEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const currentParams: SearchParams = {
    search: searchParams.get('search') || '',
    searchType: (searchParams.get('searchType') as any) || 'general',
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || '',
  };

  useEffect(() => {
    loadData();
  }, [searchParams, fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const salaryInfoList = await employeeSalaryInformationService.getAll(currentParams.search);

      // Get attendance data from CSV logs for salary sheet
      let attendanceData: any = {};
      let attendanceByName: any = {};
      try {
        const salaryAttendance = await attendanceService.getSalaryAttendance(fromDate, toDate);
        
        salaryAttendance.forEach((emp: any) => {
          // Store by empNo (trimmed)
          const empNo = (emp.empNo || '').toString().trim();
          const empName = (emp.empName || '').toString().trim().toLowerCase();
          
          const data = {
            daysInMonth: emp.daysInMonth,
            payDays: emp.payDays,
            presentDays: emp.presentDays,
            lateDays: emp.lateDays,
            absentDays: emp.absentDays,
            fridayHolidays: emp.fridayHolidays,
            weekends: emp.weekends,
          };
          
          if (empNo) attendanceData[empNo] = data;
          if (empName) attendanceByName[empName] = data;
        });
        
        console.log('Salary attendance loaded:', Object.keys(attendanceData).length, 'by code,', Object.keys(attendanceByName).length, 'by name');
        
        // Log all attendance data for debugging late count mismatch
        console.log('[SalarySheetAttendanceSummary] All attendance records:');
        Object.entries(attendanceData).forEach(([code, data]: [string, any]) => {
          if (data.lateDays > 0 || code.includes('0015')) {
            console.log(`  ${code}: present=${data.presentDays}, late=${data.lateDays}, absent=${data.absentDays}, fridays=${data.fridayHolidays}`);
          }
        });
      } catch (err) {
        console.log('Salary attendance data not available, using defaults');
      }

      // Load employee policies for late/absent deduction calculations
      let employeePolicies: any = {};
      try {
        const policies = await employeePolicyTaggingService.getAll();
        policies.forEach((policy: any) => {
          const key = policy.acNo || policy.no || policy.empNo;
          if (key) {
            employeePolicies[key] = policy;
          }
        });
        console.log('Employee policies loaded:', Object.keys(employeePolicies).length);
      } catch (err) {
        console.log('Employee policies not available');
      }

      // Fetch full details with salary breakdown for each employee (with cache-busting)
      const timestamp = Date.now();
      const fullSalaryDetails = await Promise.all(
        salaryInfoList.map(async (info) => {
          try {
            // Fetch fresh data with cache-busting query param
            const response = await api.get(`/employee-salary-information/${info.id}?_t=${timestamp}`);
            return unwrapResponse(response);
          } catch (err) {
            console.log('Failed to fetch details for', info.empCode);
            return info;
          }
        })
      );

      const mergedData: SalarySheetEmployee[] = fullSalaryDetails.map((salaryInfo: EmployeeSalaryInformation, index: number) => {
        
        // Try to match attendance by empCode first, then by name
        const empCode = (salaryInfo.empCode || '').toString().trim();
        const empName = (salaryInfo.empName || '').toString().trim().toLowerCase();
        
        let attendance = attendanceData[empCode];
        let matchMethod = 'by empCode';
        if (!attendance && empName) {
          attendance = attendanceByName[empName];
          matchMethod = 'by name';
        }
        
        // Debug: Log attendance matching for all employees with 'E0015' or similar pattern
        if (empCode.includes('E0015') || empCode.includes('0015')) {
          console.log(`[AttendanceMatch] ${empCode}/${empName}: Found=${!!attendance}, Method=${matchMethod}, LateDays=${attendance?.lateDays}, Present=${attendance?.presentDays}, Absent=${attendance?.absentDays}`);
          console.log(`[AttendanceKeys] Available empCodes:`, Object.keys(attendanceData).slice(0, 10));
          console.log(`[AttendanceKeys] Available names:`, Object.keys(attendanceByName).slice(0, 10));
        }
        
        // Default values if no attendance data found
        if (!attendance) {
          attendance = { 
            daysInMonth: 30, 
            payDays: 26, 
            presentDays: 26, 
            lateDays: 0, 
            absentDays: 0, 
            fridayHolidays: 4, 
            weekends: 4 
          };
          if (index === 0) console.log('No attendance match for:', empCode, empName);
        } else {
          if (index === 0 || empCode.includes('0015')) console.log('Attendance matched for:', empCode, 'Method:', matchMethod, 'Present:', attendance.presentDays, 'Late:', attendance.lateDays, 'Absent:', attendance.absentDays);
        }
        
        // Get raw salary breakdown from employee salary info
        const breakdown = salaryInfo.salaryBreakdown || [];
        
        // Separate additions and deductions from breakdown
        // Additions: Attendance Bonus, Incentive, Performance Bonus, and other positive amounts
        // Deductions: Provident Fund, Advance, Stamp, Tax, AIT, and negative amounts
        const additionHeads = ['Attendance Bonus', 'Incentive', 'Performance Bonus', 'Bonus'];
        const deductionHeads = ['Provident Fund', 'Advance', 'Stamp', 'Tax', 'AIT', 'Punishment Amount', 'Transport Deduction', 'Lunch Contribution', 'Late', 'Late Deduction', 'Absence', 'Absent'];

        const additions = breakdown.filter((b: SalaryBreakdown) => {
          const head = b.payrollHead || '';
          const amount = parseFloat(b.amount || '0');
          return additionHeads.includes(head) || (amount > 0 && !deductionHeads.includes(head) && !['Basic', 'House Rent', 'Medical Allowance', 'Conveyance'].includes(head));
        });

        const deductions = breakdown.filter((b: SalaryBreakdown) => {
          const head = b.payrollHead || '';
          const amount = parseFloat(b.amount || '0');
          return deductionHeads.includes(head) || amount < 0;
        });

        // Calculate total additions (sum of all addition amounts)
        const totalAdditions = additions.reduce((sum: number, a: SalaryBreakdown) => sum + parseFloat(a.amount || '0'), 0);
        
        // Debug: log breakdown for first employee
        if (index === 0) {
          console.log('Salary Breakdown for', salaryInfo.empCode, ':', breakdown);
          console.log('Additions:', additions);
          console.log('Deductions:', deductions);
        }
        
        // Get amounts from salary breakdown directly
        const getAmount = (head: string) => {
          const item = breakdown.find((b: SalaryBreakdown) => {
            const ph = (b.payrollHead || '').toLowerCase();
            const search = head.toLowerCase();
            
            return ph.includes(search) || 
                   (search === 'basic' && (ph.includes('basic'))) ||
                   (search === 'house' && (ph.includes('house') || ph.includes('rent'))) ||
                   (search === 'medical' && (ph.includes('medical'))) ||
                   (search === 'transport' && (ph.includes('transport') || ph.includes('conveyance'))) ||
                   (search === 'food' && (ph.includes('food') || ph.includes('meal')));
          });
          
          const amount = parseFloat(item?.amount || '0');
          if (index === 0) console.log(`Looking for "${head}", found:`, item?.payrollHead, 'amount:', amount);
          return amount;
        };

        // Get values ONLY from salary breakdown
        const basic = getAmount('basic');
        const houseRent = getAmount('house') || getAmount('rent');
        const medicalAllowance = getAmount('medical');
        const conveyance = getAmount('transport') || getAmount('conveyance');
        
        // Gross ONLY from database grossSalary field
        const gross = parseFloat(salaryInfo.grossSalary || '0');
        
        // Attendance data from CSV logs
        const daysInMonth = attendance.daysInMonth;
        const presentDays = attendance.presentDays;
        const absentDays = attendance.absentDays;
        const lateDays = attendance.lateDays;
        const payDays = attendance.payDays;
        const fridayHolidays = attendance.fridayHolidays;
        const weekends = attendance.weekends;
        
        // Get employee policy for late/absent deduction calculations
        const policyKey = salaryInfo.acNo || salaryInfo.empCode || empCode;
        const empPolicy = policyKey ? employeePolicies[policyKey] : null;
        const lateDeductionPolicy = (empPolicy?.lateDeductionPolicyRule || '').toUpperCase().trim();
        const absentDeductionPolicy = (empPolicy?.absentDeductionPolicyRule || '').toUpperCase().trim().replace(/ /g, '_');
        
        if (index === 0) console.log(`Policies for ${empCode}: Late='${lateDeductionPolicy}', Absent='${absentDeductionPolicy}'`);
        
        // STEP 1: Calculate Late Deduction
        // Late Deduction Policy: APPLICABLE = 6 late days = 1 absent day
        //                        NOT_APPLICABLE or empty = no late deduction
        let lateAbsentDays = 0; // Converted late days to absent days (6 late = 1 absent)
        let lateDeduction = 0;
        
        if (lateDeductionPolicy === 'APPLICABLE' && lateDays > 0) {
          // 6 late days = 1 absent day
          lateAbsentDays = Math.floor(lateDays / 6);
          if (index === 0) console.log(`Late deduction APPLICABLE: ${lateDays} late days = ${lateAbsentDays} absent days`);
        } else {
          if (index === 0) console.log(`Late deduction NOT APPLICABLE or no late days`);
        }
        
        // STEP 2: Calculate Absent Deduction
        // Absent Deduction Policy: ON_BASIC = (basic / daysInMonth) * totalAbsent
        //                          ON_GROSS = (gross / daysInMonth) * totalAbsent
        //                          N/A or empty = no absent deduction
        let absentAmount = 0;
        const totalAbsentDays = absentDays + lateAbsentDays;
        
        if (absentDeductionPolicy === 'ON_BASIC' && totalAbsentDays > 0 && daysInMonth > 0 && basic > 0) {
          const perDayBasic = basic / daysInMonth;
          absentAmount = Math.round(perDayBasic * totalAbsentDays);
          lateDeduction = Math.round(perDayBasic * lateAbsentDays); // Late portion of deduction
          if (index === 0) console.log(`Absent deduction ON_BASIC: ${totalAbsentDays} days × ${perDayBasic.toFixed(2)} = ${absentAmount} (Late portion: ${lateDeduction})`);
        } else if (absentDeductionPolicy === 'ON_GROSS' && totalAbsentDays > 0 && daysInMonth > 0 && gross > 0) {
          const perDayGross = gross / daysInMonth;
          absentAmount = Math.round(perDayGross * totalAbsentDays);
          lateDeduction = Math.round(perDayGross * lateAbsentDays); // Late portion of deduction
          if (index === 0) console.log(`Absent deduction ON_GROSS: ${totalAbsentDays} days × ${perDayGross.toFixed(2)} = ${absentAmount} (Late portion: ${lateDeduction})`);
        } else {
          if (index === 0) console.log(`Absent deduction N/A or conditions not met: policy='${absentDeductionPolicy}', absent=${absentDays}, lateAbsent=${lateAbsentDays}`);
        }
        
        // Get other deductions from breakdown
        const leaveAmount = getAmount('leave') || 0;
        
        // Total deductions: payroll head deductions + policy-based absent/late deductions
        const payrollDeductions = deductions.reduce((sum: number, d: SalaryBreakdown) => sum + Math.abs(parseFloat(d.amount || '0')), 0);
        const totalDeduction = payrollDeductions + absentAmount; // absentAmount already includes late portion

        // Net Payable = Gross - Total Late Deduction
        // This is the final amount after all deductions
        const netPayable = gross - totalDeduction;

        // Net Pay (for display purposes, same as netPayable now)
        const netPay = netPayable;

        // Get deduction amounts for display purposes (already included in netPay)
        const advance = getAmount('advance');
        const tax = getAmount('tax') || getAmount('AIT');
        const stamp = getAmount('stamp');
        const otAmount = 0;

        // Bank/Cash from salary info directly
        const bankInfo = salaryInfo.bankInfos?.[0];
        const inBank = bankInfo ? parseFloat(bankInfo.salaryAmount || '0') : 0;
        const inCash = netPayable - inBank;

        // Save calculated deductions and net_payable to database (fire and forget, don't block UI)
        // net_payable = Gross - Total Late Deduction
        if (empCode) {
          employeeSalaryInformationService.updateDeductions({
            empCode: salaryInfo.empCode || empCode,
            absentAmount: absentAmount,
            lateDeduct: lateDeduction,
            totalDeductions: totalDeduction,
            finalPayable: netPayable  // This saves to net_payable column in database
          }).catch((err: any) => {
            console.log('Failed to save deductions for', empCode, err);
          });
        }
        
        return {
          // CSV 4 columns - mapped directly from backend join
          empNo: salaryInfo.empNo || '-',
          acNo: salaryInfo.acNo || '-',
          no: salaryInfo.no || salaryInfo.empCode || '-',
          name: salaryInfo.name || salaryInfo.empName || '-',
          designation: salaryInfo.designation || '-',
          joinDate: salaryInfo.joinDate || '-',
          grade: salaryInfo.sGrade || '-',
          resignDate: '-',
          salary: {
            basic: basic,
            houseRent: houseRent,
            medical: medicalAllowance,
            transport: conveyance,
            conveyance: conveyance,
            gross: gross,
          },
          attendance: {
            daysInMonth,
            payDays,
            presentDays,
            lateDays,
            absentDays,
            fridayHolidays,
            weekends,
            cl: 0,
            sl: 0,
            ml: 0,
            el: 0,
          },
          deduction: {
            absentAmount,
            lateDeduction,
            leaveAmount,
            totalDeduction,
            netPay,
          },
          overtime: {
            hours: 0,
            rate: 0,
            amount: 0,
          },
          totalWages: netPayable,
          totalAdditions,
          advance,
          tax,
          stamp,
          netPayable,
          inBank,
          inCash,
          bankInfo,
        };
      });

      const searchTerm = currentParams.search || '';
      const filteredData = searchTerm
        ? mergedData.filter((emp: SalarySheetEmployee) =>
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.designation.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : mergedData;

      setSalaryData(filteredData);
    } catch (err: any) {
      console.error('Failed to load salary sheet:', err);
      setError(err.message || 'Failed to load salary sheet data');
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return salaryData.reduce(
      (acc, emp) => ({
        totalEmployees: acc.totalEmployees + 1,
        totalBasic: acc.totalBasic + emp.salary.basic,
        totalHouseRent: acc.totalHouseRent + emp.salary.houseRent,
        totalMedical: acc.totalMedical + emp.salary.medical,
        totalTransport: acc.totalTransport + emp.salary.transport,
        totalConveyance: acc.totalConveyance + emp.salary.conveyance,
        totalGross: acc.totalGross + emp.salary.gross,
        totalAbsent: acc.totalAbsent + emp.deduction.absentAmount,
        totalDeduction: acc.totalDeduction + emp.deduction.totalDeduction,
        totalAdditions: acc.totalAdditions + emp.totalAdditions,
        totalNetPay: acc.totalNetPay + emp.deduction.netPay,
        totalNetPayable: acc.totalNetPayable + emp.netPayable,
        totalInBank: acc.totalInBank + emp.inBank,
        totalInCash: acc.totalInCash + emp.inCash,
      }),
      {
        totalEmployees: 0, totalBasic: 0, totalHouseRent: 0, totalMedical: 0,
        totalTransport: 0, totalConveyance: 0, totalGross: 0, totalAbsent: 0,
        totalDeduction: 0, totalAdditions: 0, totalNetPay: 0, totalNetPayable: 0,
        totalInBank: 0, totalInCash: 0,
      }
    );
  }, [salaryData]);

  const dateRangeDisplay = useMemo(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, [fromDate, toDate]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading salary sheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold">Salary Sheet</h4>
          <p className="text-muted mb-0 small">Employee salary report for {dateRangeDisplay}</p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="fromDate" className="form-label mb-0 text-muted small">From:</label>
            <input
              id="fromDate"
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: '140px' }}
              title="Start date for salary sheet"
            />
            <label htmlFor="toDate" className="form-label mb-0 text-muted small">To:</label>
            <input
              id="toDate"
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: '140px' }}
              title="End date for salary sheet"
            />
          </div>
          <SearchBar params={currentParams} />
          <button onClick={() => window.print()} className="btn btn-outline-dark">
            <i className="fas fa-print me-2"></i> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {salaryData.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="mb-4">
              <i className="fas fa-file-invoice-dollar fa-3x text-muted opacity-50"></i>
            </div>
            <h5 className="text-muted mb-3">No Salary Data Found</h5>
            <p className="text-muted mb-0">
              No salary records match your search criteria. Please add salary information in the Employee Salary Information section.
            </p>
          </div>
        </div>
      ) : (
        <div className="salary-sheet-container" style={{ overflowX: 'auto' }}>
          {/* Salary Sheet Header - Reference Format */}
          <div className="text-center mb-3">
            <h3 className="fw-bold mb-1">Skyview Online LTD</h3>
            <p className="mb-0 small">153/1, Shahid Faroque Rd, Dhaka 1204</p>
            <h5 className="fw-bold mt-2">Salary Sheet For The Period {dateRangeDisplay}</h5>
          </div>

          {/* Main Salary Sheet Table - Reference Format */}
          <div className="salary-table-wrapper" style={{ overflowX: 'auto', border: '2px solid #000', maxHeight: '70vh', position: 'relative' }}>
            <table className="table table-bordered table-sm salary-table mb-0" style={{ fontSize: '9px', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '1400px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Header Row 1 - Main Sections */}
                <tr style={{ backgroundColor: '#e0e0e0' }}>
                  <th rowSpan={3} style={{ width: '22px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle' }}>SL</th>
                  <th colSpan={7} style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>General Information</th>
                  <th colSpan={6} style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>Salary Structure</th>
                  <th colSpan={11} style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>Attendance</th>
                  <th colSpan={5} style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>Leave</th>
                  <th colSpan={6} style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>Deduction</th>
                  <th rowSpan={3} style={{ width: '50px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#90ee90' }}>Final<br/>Payable</th>
                  <th rowSpan={3} style={{ width: '45px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#c8e6c9' }}>Net<br/>Payable<br/><small>(from Salary)</small></th>
                  <th rowSpan={3} style={{ width: '45px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#90ee90' }}>Final<br/>Payable</th>
                  <th rowSpan={3} style={{ width: '40px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle' }}>In<br/>Bank</th>
                  <th rowSpan={3} style={{ width: '40px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle' }}>In<br/>Cash</th>
                  <th rowSpan={3} style={{ width: '35px', border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center', verticalAlign: 'middle' }}>Sign</th>
                </tr>
                {/* Header Row 2 - Sub Sections with Vertical Text */}
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  {/* General Info - Row 2 */}
                  <th rowSpan={2} className="v-header"><span>AC-No.</span></th>
                  <th rowSpan={2} className="v-header"><span>Join Date</span></th>
                  <th rowSpan={2} className="v-header"><span>Resign Date</span></th>
                  <th rowSpan={2} className="v-header"><span>Grade</span></th>
                  <th rowSpan={2} style={{ width: '320px', minWidth: '320px', height: '60px', border: '1px solid #000', padding: '2px', background: '#f0f0f0', verticalAlign: 'middle' }}><span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', display: 'block', whiteSpace: 'nowrap', fontSize: '8px', fontWeight: 600, lineHeight: 1, textAlign: 'center' }}>Name</span></th>
                  <th rowSpan={2} className="v-header"><span>Designation</span></th>
                  <th rowSpan={2} className="v-header"><span>Emp No.</span></th>
                  {/* Salary - Row 2 */}
                  <th rowSpan={2} className="v-header"><span>Basic</span></th>
                  <th rowSpan={2} className="v-header"><span>House Rent</span></th>
                  <th rowSpan={2} className="v-header"><span>Medical</span></th>
                  <th rowSpan={2} className="v-header"><span>Transport</span></th>
                  <th rowSpan={2} className="v-header"><span>Food</span></th>
                  <th rowSpan={2} className="v-header highlight"><span>Gross Salary</span></th>
                  {/* Attendance - Row 2 */}
                  <th rowSpan={2} className="v-header"><span>Day of Month</span></th>
                  <th rowSpan={2} className="v-header"><span>Pay Days</span></th>
                  <th rowSpan={2} className="v-header"><span>Present Day</span></th>
                  <th rowSpan={2} className="v-header"><span>Late</span></th>
                  <th rowSpan={2} className="v-header"><span>Absent</span></th>
                  <th rowSpan={2} className="v-header"><span>Friday Holiday</span></th>
                  <th rowSpan={2} className="v-header"><span>Weekend</span></th>
                  <th colSpan={4} style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', textAlign: 'center' }}>Leave</th>
                  {/* Leave Section - Row 2 */}
                  <th rowSpan={2} className="v-header"><span>Leave Without Pay</span></th>
                  <th rowSpan={2} className="v-header"><span>Annual Leave</span></th>
                  <th rowSpan={2} className="v-header"><span>Medical Leave</span></th>
                  <th rowSpan={2} className="v-header"><span>Total Leave Deduc</span></th>
                  {/* Deduction - Row 2 */}
                  <th rowSpan={2} className="v-header"><span>Absent Amount</span></th>
                  <th rowSpan={2} className="v-header"><span>Late Deduc</span></th>
                  <th rowSpan={2} className="v-header"><span>Loan/Advance</span></th>
                  <th rowSpan={2} className="v-header"><span>Tax (AIT)</span></th>
                  <th rowSpan={2} className="v-header red-bg"><span>Total Deduction</span></th>
                  <th rowSpan={2} className="v-header" style={{ backgroundColor: '#e3f2fd' }}><span>Total Addition</span></th>
                </tr>
                {/* Header Row 3 - Leave Types */}
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th className="v-header-small"><span>CL</span></th>
                  <th className="v-header-small"><span>SL</span></th>
                  <th className="v-header-small"><span>ML</span></th>
                  <th className="v-header-small"><span>EL</span></th>
                </tr>
              </thead>
              <tbody>
                {salaryData.map((emp, index) => (
                  <tr key={emp.acNo} style={{ height: '26px' }}>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{index + 1}</td>
                    {/* General Info */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.acNo}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.joinDate}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.resignDate || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.grade}</td>
                    <td style={{ width: '320px', border: '1px solid #000', padding: '2px', textAlign: 'left', fontSize: '8px', wordWrap: 'break-word', overflow: 'visible' }}>{emp.name}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'left', fontSize: '8px' }}>{emp.designation}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.empNo}</td>
                    {/* Salary Structure */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.salary.basic > 0 ? emp.salary.basic.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.salary.houseRent > 0 ? emp.salary.houseRent.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.salary.medical > 0 ? emp.salary.medical.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.salary.transport > 0 ? emp.salary.transport.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.salary.conveyance > 0 ? emp.salary.conveyance.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>{emp.salary.gross > 0 ? emp.salary.gross.toLocaleString() : '-'}</td>
                    {/* Attendance */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.daysInMonth}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold', color: '#006400' }}>{emp.attendance.payDays}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.presentDays}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px', color: '#ff8c00' }}>{emp.attendance.lateDays}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px', color: '#dc143c' }}>{emp.attendance.absentDays}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.fridayHolidays}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.weekends}</td>
                    {/* Leave */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.cl}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.sl}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.ml}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>{emp.attendance.el}</td>
                    {/* Leave Deduction */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>-</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>-</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>-</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '8px' }}>-</td>
                    {/* Deduction */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', color: '#c62828' }}>{emp.deduction.absentAmount > 0 ? emp.deduction.absentAmount.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', color: '#c62828' }}>{emp.deduction.lateDeduction > 0 ? emp.deduction.lateDeduction.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', color: '#c62828' }}>{emp.advance > 0 ? emp.advance.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', color: '#c62828' }}>{emp.tax > 0 ? emp.tax.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#c62828', backgroundColor: '#ffebee' }}>{emp.deduction.totalDeduction > 0 ? emp.deduction.totalDeduction.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1565c0', backgroundColor: '#e3f2fd' }}>{emp.totalAdditions > 0 ? emp.totalAdditions.toLocaleString() : '-'}</td>
                    {/* Net Pay & Payable */}
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold', backgroundColor: '#c8e6c9' }}>{emp.deduction.netPay.toLocaleString()}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', backgroundColor: '#90ee90' }}>{emp.netPayable.toLocaleString()}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.inBank > 0 ? emp.inBank.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'right', fontSize: '8px', fontFamily: 'monospace' }}>{emp.inCash > 0 ? emp.inCash.toLocaleString() : '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2px' }}></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#d0d0d0', height: '28px' }}>
                  <td colSpan={8} style={{ border: '1px solid #000', padding: '3px', fontSize: '9px', fontWeight: 'bold', textAlign: 'center' }}>Grand Total:</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalBasic > 0 ? totals.totalBasic.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalHouseRent > 0 ? totals.totalHouseRent.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalMedical > 0 ? totals.totalMedical.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalTransport > 0 ? totals.totalTransport.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalConveyance > 0 ? totals.totalConveyance.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', backgroundColor: '#c0c0c0' }}>{totals.totalGross > 0 ? totals.totalGross.toLocaleString() : '-'}</td>
                  <td colSpan={15} style={{ border: '1px solid #000', padding: '3px' }}></td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', color: '#8b0000' }}>{totals.totalAbsent > 0 ? totals.totalAbsent.toLocaleString() : '-'}</td>
                  <td></td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '3px' }}></td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', color: '#8b0000', backgroundColor: '#ffcdd2' }}>{totals.totalDeduction > 0 ? totals.totalDeduction.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', color: '#1565c0', backgroundColor: '#bbdefb' }}>{totals.totalAdditions > 0 ? totals.totalAdditions.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', backgroundColor: '#a5d6a7' }}>{totals.totalNetPay.toLocaleString()}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '9px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', backgroundColor: '#81c784' }}>{totals.totalNetPayable.toLocaleString()}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalInBank > 0 ? totals.totalInBank.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>{totals.totalInCash > 0 ? totals.totalInCash.toLocaleString() : '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer Signatures */}
          <div className="mt-4 pt-3">
            <div className="d-flex justify-content-between text-center" style={{ fontSize: '9px' }}>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>Prepared by</strong>
                </div>
              </div>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>Acc & Finance</strong>
                </div>
              </div>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>HR & Admin</strong>
                </div>
              </div>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>Head Of Department</strong>
                </div>
              </div>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>Head Of Account</strong>
                </div>
              </div>
              <div style={{ flex: 1, padding: '0 10px' }}>
                <div style={{ borderTop: '1px solid #000', marginTop: '35px', paddingTop: '3px' }}>
                  <strong>Managing Director</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Vertical Header Styles */
        .v-header {
          width: 18px;
          min-width: 18px;
          height: 60px;
          border: 1px solid #000;
          padding: 2px;
          background: #f0f0f0;
          vertical-align: middle;
        }
        .v-header span {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          display: block;
          white-space: nowrap;
          font-size: 8px;
          font-weight: 600;
          line-height: 1;
          text-align: center;
        }
        .v-header-small {
          width: 18px;
          min-width: 18px;
          height: 40px;
          border: 1px solid #000;
          padding: 2px;
          background: #f5f5f5;
          vertical-align: middle;
        }
        .v-header-small span {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          display: block;
          white-space: nowrap;
          font-size: 9px;
          font-weight: 600;
          line-height: 1;
          text-align: center;
        }
        .v-header.highlight {
          background: #d0d0d0;
        }
        .v-header.red-bg {
          background: #ffcdd2;
        }
        .v-header.highlight span,
        .v-header.red-bg span {
          font-weight: bold;
        }
        .salary-table-wrapper {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }
        .salary-table-wrapper::-webkit-scrollbar {
          height: 12px;
          width: 12px;
        }
        .salary-table-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 6px;
        }
        .salary-table-wrapper::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 6px;
          border: 2px solid #f1f1f1;
        }
        .salary-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .salary-table th,
        .salary-table td {
          vertical-align: middle;
          padding: 4px 6px;
        }
        .salary-table thead th {
          font-weight: 600;
          border-bottom: 2px solid #000;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .salary-table thead tr:first-child th {
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .salary-table tfoot td {
          border-top: 2px solid #000;
          font-weight: 700;
        }
        @media print {
          .top-bar, .no-print, .salary-table-wrapper {
            overflow: visible !important;
            max-height: none !important;
          }
          .salary-sheet-container {
            overflow: visible !important;
          }
          .salary-table thead th {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
