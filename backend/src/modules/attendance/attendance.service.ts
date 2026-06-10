import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import * as fs from 'fs';
import csvParser from 'csv-parser';
import {
  AttendanceStats,
  PaginationData,
  JobCardEmployee,
  JobCardDailyRecord,
  JobCardSummary,
  MonthlyEmployee,
} from './interfaces/attendance.interface';
import { SearchAttendanceDto } from './dto/search-attendance.dto';

// Attendance record for frontend display
export interface AttendanceDisplayRecord {
  status: 'Present' | 'Absent';
  acNo: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string;
  late: string;
  department: string;
}

/**
 * HELPER: Normalizes CSV headers to handle variations automatically
 */
class CsvColumnMapper {
  private mapStore: Map<string, string> = new Map();

  constructor(headers: string[]) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    headers.forEach(original => {
      const norm = normalize(original);
      if (norm.includes('empno') || norm.includes('employeeno')) this.mapStore.set('empNo', original);
      if (norm.includes('acno')) this.mapStore.set('acNo', original);
      if (norm.includes('no') && !this.mapStore.has('no')) this.mapStore.set('no', original);
      if (norm.includes('name')) this.mapStore.set('name', original);
      if (norm.includes('date')) this.mapStore.set('date', original);
      if (norm.includes('clockin') || norm === 'in' || (norm.includes('clock') && norm.includes('in'))) this.mapStore.set('clockIn', original);
      if (norm.includes('clockout') || norm === 'out' || (norm.includes('clock') && norm.includes('out'))) this.mapStore.set('clockOut', original);
      if (norm.includes('dept') || norm.includes('department')) this.mapStore.set('department', original);
      if (norm.includes('status')) this.mapStore.set('status', original);
      if (norm.includes('absent')) this.mapStore.set('absent', original);
    });
  }

  getValue(record: any, key: string): string {
    const originalHeader = this.mapStore.get(key);
    return originalHeader ? (record[originalHeader] || '').toString().trim() : '';
  }

  has(key: string): boolean {
    return this.mapStore.has(key);
  }
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(SQL_CONNECTION) private readonly db: mysql.Pool,
    private readonly configService: ConfigService,
  ) {
    // Initialize custom shifts on service startup
    this.initializeCustomShifts().catch(err => 
      console.error('[AttendanceService] Failed to initialize shifts:', err)
    );
  }

  /**
   * STRICT Employee Resolution: Uses AC-No. as single identity
   * Returns all 4 identity columns for display/storage, but lookup is by AC-No. only
   */
  private async resolveEmployeeStrict(row: { acNo: string }): Promise<any | null> {
    if (!row.acNo || row.acNo === '') return null;
    
    const [rows] = await this.db.execute(
      `SELECT \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, Department 
       FROM csv_employees WHERE \`AC-No.\` = ? LIMIT 1`,
      [row.acNo]
    );
    return (rows as any[]).length > 0 ? (rows as any[])[0] : null;
  }

  /**
   * Sync unique employees from CSV records to csv_employees table
   * Extracts unique AC-No. values and inserts them if not exists
   * Stores all 4 identity columns but AC-No. is the lookup key
   */
  private async syncCsvEmployeesFromRecords(records: any[], mapper: CsvColumnMapper): Promise<void> {
    // Extract unique employees by AC-No. from records
    const uniqueEmployees = new Map<string, { empNo: string, no: string, name: string, department: string }>();
    
    for (const record of records) {
      const acNo = mapper.getValue(record, 'acNo');
      const empNo = mapper.getValue(record, 'empNo') || '';
      const no = mapper.getValue(record, 'no') || '';
      const name = mapper.getValue(record, 'name') || '';
      const department = mapper.getValue(record, 'department') || '';
      if (acNo && acNo.trim() !== '') {
        uniqueEmployees.set(acNo, { empNo, no, name, department });
      }
    }
    
    if (uniqueEmployees.size === 0) {
      console.log('[CSV Import] No valid AC-No. values found in records');
      return;
    }
    
    console.log(`[CSV Import] Found ${uniqueEmployees.size} unique employees to sync to csv_employees`);
    
    // Insert or update each unique employee
    let inserted = 0;
    let existing = 0;
    
    for (const [acNo, data] of uniqueEmployees) {
      try {
        // Check if already exists
        const [rows] = await this.db.execute(
          `SELECT id FROM csv_employees WHERE \`AC-No.\` = ? LIMIT 1`,
          [acNo]
        );
        
        if ((rows as any[]).length === 0) {
          // Insert new employee with all 4 identity columns
          await this.db.execute(
            `INSERT INTO csv_employees (\`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, Department, is_active) 
             VALUES (?, ?, ?, ?, ?, 1)`,
            [data.empNo, acNo, data.no, data.name, data.department]
          );
          inserted++;
        } else {
          existing++;
        }
      } catch (err: any) {
        console.error(`[CSV Import] Error syncing AC-No. ${acNo}:`, err.message);
      }
    }
    
    console.log(`[CSV Import] csv_employees sync complete: ${inserted} inserted, ${existing} already exist`);
  }

  /**
   * Initialize/update shifts to match the user's requirements
   * Updates EXISTING shifts in the database with correct times
   */
  private async initializeCustomShifts(): Promise<void> {
    // Update existing shifts to have EXACT names matching policy dropdown
    // This ensures shift_name in DB = shift_policy_rule in employee_policy_tagging
    const shiftUpdates = [
      {
        shift_code: 'MORNING_8AM',  // "Morning Shift (8 AM - 4 PM)" - exactly as in dropdown
        shift_name: 'Morning Shift (8 AM - 4 PM)',
        start_time: '08:00:00',
        end_time: '16:00:00',
        grace_period_minutes: 45,
        is_night_shift: false,
      },
      {
        shift_code: 'EVENING_3PM',  // "Evening Shift (3 PM - 11 PM)"
        shift_name: 'Evening Shift (3 PM - 11 PM)',
        start_time: '15:00:00',
        end_time: '23:00:00',
        grace_period_minutes: 45,
        is_night_shift: false,
      },
      {
        shift_code: 'NIGHT_11PM',  // "Night Shift (11PM - 8 AM)" - note: no space in 11PM
        shift_name: 'Night Shift (11PM - 8 AM)',
        start_time: '23:00:00',
        end_time: '08:00:00',
        grace_period_minutes: 45,
        is_night_shift: true,
      },
      {
        shift_code: 'GENERAL_10AM',  // "General shift (10 AM - 6 PM)" - lowercase 'shift'
        shift_name: 'General shift (10 AM - 6 PM)',
        start_time: '10:00:00',
        end_time: '18:00:00',
        grace_period_minutes: 45,
        is_night_shift: false,
      },
      {
        shift_code: 'RAMADAN_9AM',  // "Ramadan Shift (9 AM - 4 PM)"
        shift_name: 'Ramadan Shift (9 AM - 4 PM)',
        start_time: '09:00:00',
        end_time: '16:00:00',
        grace_period_minutes: 45,
        is_night_shift: false,
      },
    ];

    try {
      for (const shift of shiftUpdates) {
        await this.db.execute(
          `INSERT INTO shifts (shift_code, shift_name, start_time, end_time, grace_period_minutes, is_night_shift, is_active)
           VALUES (?, ?, ?, ?, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE
             shift_name = VALUES(shift_name),
             start_time = VALUES(start_time),
             end_time = VALUES(end_time),
             grace_period_minutes = VALUES(grace_period_minutes),
             is_night_shift = VALUES(is_night_shift),
             is_active = TRUE,
             updated_at = NOW()`,
          [shift.shift_code, shift.shift_name, shift.start_time, shift.end_time, shift.grace_period_minutes, shift.is_night_shift]
        );
        console.log(`[AttendanceService] Upserted shift: ${shift.shift_code} (${shift.shift_name}) -> ${shift.start_time}-${shift.end_time}`);
      }
      console.log('[AttendanceService] Custom shifts initialized successfully');
    } catch (error) {
      console.error('[AttendanceService] Error initializing custom shifts:', error);
    }
  }

  /**
   * Get employee policies from employee_policy_tagging
   */
  private async getEmployeePolicies(empCode: string): Promise<{
    lateDeductionPolicy: string;
    absentDeductionPolicy: string;
    shiftPolicyRule: string;
  }> {
    try {
      // Try multiple code variations
      const variations = [empCode];
      if (empCode.startsWith('E') && /^E\d+$/i.test(empCode)) {
        variations.push(`EMP${empCode.substring(1)}`);
        variations.push(empCode.substring(1));
      } else if (!empCode.startsWith('EMP')) {
        variations.push(`EMP${empCode}`);
        variations.push(`E${empCode}`);
      }

      for (const codeVar of variations) {
        const [rows] = await this.db.execute(
          `SELECT late_deduction_policy_rule, absent_deduction_policy_rule, shift_policy_rule
           FROM employee_policy_tagging
           WHERE \`AC-No.\` = ?
           ORDER BY id DESC LIMIT 1`,
          [codeVar]
        );
        
        const policies = rows as any[];
        if (policies.length > 0) {
          return {
            lateDeductionPolicy: policies[0].late_deduction_policy_rule || 'N/A',
            absentDeductionPolicy: policies[0].absent_deduction_policy_rule || 'N/A',
            shiftPolicyRule: policies[0].shift_policy_rule || 'N/A'
          };
        }
      }
    } catch (error: any) {
      console.log(`[Policies] Error fetching for ${empCode}:`, error.message);
    }
    
    return {
      lateDeductionPolicy: 'N/A',
      absentDeductionPolicy: 'N/A',
      shiftPolicyRule: 'N/A'
    };
  }

  /**
   * Get employee gross salary from employee_salary_information
   */
  private async getEmployeeGrossSalary(empCode: string): Promise<number> {
    try {
      const variations = [empCode];
      if (empCode.startsWith('E') && /^E\d+$/i.test(empCode)) {
        variations.push(`EMP${empCode.substring(1)}`);
        variations.push(empCode.substring(1));
      } else if (!empCode.startsWith('EMP')) {
        variations.push(`EMP${empCode}`);
        variations.push(`E${empCode}`);
      }

      for (const codeVar of variations) {
        const [rows] = await this.db.execute(
          `SELECT gross_salary FROM employee_salary_information
           WHERE \`AC-No.\` = ?
           LIMIT 1`,
          [codeVar]
        );
        
        const salaryData = rows as any[];
        if (salaryData.length > 0 && salaryData[0].gross_salary) {
          return parseFloat(salaryData[0].gross_salary) || 0;
        }
      }
    } catch (error: any) {
      console.log(`[Salary] Error fetching gross for ${empCode}:`, error.message);
    }
    
    return 0;
  }

  /**
   * Get employee shift information including start time with grace period
   */
  private async getEmployeeShiftInfo(empCode: string, date: Date, empName?: string): Promise<{
    shiftName: string;
    startTime: string;
    startTimeWithGrace: string;
    gracePeriod: number;
  }> {
    const shiftStartWithGrace = await this.getEmployeeShiftStartTime(empCode, date, empName);
    
    // Parse the grace period from the returned time
    // Default grace is 45 minutes
    let gracePeriod = 45;
    
    // Try to get actual shift info from database
    try {
      const policies = await this.getEmployeePolicies(empCode);
      if (policies.shiftPolicyRule && policies.shiftPolicyRule !== 'N/A') {
        const shift = await this.getShiftFromPolicyRule(policies.shiftPolicyRule);
        if (shift) {
          gracePeriod = shift.grace_period_minutes || 45;
          // Calculate start time with grace
          const [shiftHours, shiftMinutes] = shift.start_time.split(':').map(Number);
          const totalMinutesWithGrace = shiftHours * 60 + shiftMinutes + gracePeriod;
          const graceHours = Math.floor(totalMinutesWithGrace / 60) % 24;
          const graceMins = totalMinutesWithGrace % 60;
          const startTimeWithGrace = `${String(graceHours).padStart(2, '0')}:${String(graceMins).padStart(2, '0')}`;
          
          return {
            shiftName: shift.shift_name,
            startTime: shift.start_time,
            startTimeWithGrace: startTimeWithGrace,
            gracePeriod
          };
        }
      }
    } catch (e) {
      // Fallback to defaults
    }
    
    // Calculate original start time from shiftStartWithGrace (which includes grace)
    const [hours, minutes] = shiftStartWithGrace.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes - gracePeriod;
    const originalHours = Math.floor(totalMinutes / 60) % 24;
    const originalMinutes = totalMinutes % 60;
    const originalStartTime = `${String(originalHours).padStart(2, '0')}:${String(originalMinutes).padStart(2, '0')}`;
    
    return {
      shiftName: 'General shift (10 AM - 6 PM)',
      startTime: originalStartTime,
      startTimeWithGrace: shiftStartWithGrace,
      gracePeriod
    };
  }

  /**
   * Get attendance records from logs table (CSV data)
   */
  async getRecords(dto: SearchAttendanceDto): Promise<PaginationData<AttendanceDisplayRecord>> {
    const allRecords = await this.loadFromLogsTable(dto);
    const perPage = 20;
    const total = allRecords.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(Math.max(1, dto.page || 1), totalPages);
    const offset = (currentPage - 1) * perPage;

    // Convert string[][] to AttendanceDisplayRecord format
    const displayRecords = allRecords.slice(offset, offset + perPage).map(record => ({
      status: record[0] as 'Present' | 'Absent',
      acNo: record[2] || '',
      name: record[4] || '',
      date: record[6] || '',
      clockIn: record[10] || '',
      clockOut: record[11] || '',
      late: record[14] || '',
      department: record[22] || '',
    }));

    return {
      records: displayRecords,
      total,
      currentPage,
      totalPages,
      perPage,
    };
  }

  /**
   * Get attendance statistics
   * Uses attendance table (CSV data) instead of real-time logs
   */
  async getStats(dto: SearchAttendanceDto): Promise<AttendanceStats & { total: number; fromDate?: string; toDate?: string }> {
    // Use logs table which contains CSV data with calculated fields
    const records = await this.loadFromLogsTable(dto);
    const present = records.filter(r => r[0] === 'Present').length;
    const absent = records.filter(r => r[0] === 'Absent').length;

    return {
      present,
      absent,
      total: records.length,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
    };
  }

  /**
   * Get job cards - aggregate by employee
   * Uses only CSV logs data (not punch machine data)
   * Shows stored calculated_late from logs table
   */
  async getJobCards(dto: SearchAttendanceDto): Promise<JobCardEmployee[]> {
    // Ensure view is set to job_card for CSV-only data
    const jobCardDto = { ...dto, view: 'job_card' as const };
    const records = await this.loadFromLogsTable(jobCardDto);
    const grouped = this.groupByEmployee(records);

    return Object.entries(grouped).map(([_, group]) => {
      const summary = this.calculateJobCardSummary(group.records, dto.fromDate, dto.toDate);
      const dailyRecords = this.buildDailyRecords(group.records, dto.fromDate, dto.toDate);

      return {
        empNo: group.empNo,
        acNo: group.acNo,
        no: group.no,
        name: group.name,
        dept: group.dept,
        summary,
        records: dailyRecords,
      };
    });
  }

  /**
   * Get monthly data
   * Uses only CSV logs data (not punch machine data)
   */
  async getMonthlyData(dto: SearchAttendanceDto): Promise<{ year: number; month: string; ym: string; employees: MonthlyEmployee[] }[]> {
    // Ensure view is set to monthly for CSV-only data
    const monthlyDto = { ...dto, view: 'monthly' as const };
    const records = await this.loadFromLogsTable(monthlyDto);
    const grouped = this.groupByEmployee(records);

    // Determine date range from records if no dates provided
    let fromDate = dto.fromDate;
    let toDate = dto.toDate;

    if ((!fromDate || !toDate) && records.length > 0) {
      const dates = records.map(r => this.parseDate(r[6])).filter(d => d) as string[];
      if (dates.length > 0) {
        dates.sort();
        fromDate = dates[0];
        toDate = dates[dates.length - 1];
      }
    }

    const segments = this.getMonthSegments(fromDate, toDate);

    return segments.map(segment => {
      const employees: MonthlyEmployee[] = [];

      Object.entries(grouped).forEach(([_, group]) => {
        const filtered = group.records.filter(r => {
          const recordDate = this.parseDate(r[6]); // date column
          return recordDate && recordDate.startsWith(segment.ym);
        });

        if (filtered.length > 0) {
          const daysData = this.buildMonthlyDaysData(filtered, segment.ym);
          const totals = this.calculateMonthlyTotals(daysData);

          employees.push({
            empNo: group.empNo,
            acNo: group.acNo,
            no: group.no,
            name: group.name,
            records: daysData,
            present: totals.present,
            absent: totals.absent,
            late: totals.late,
          });
        }
      });

      return { ...segment, employees };
    });
  }

  /**
   * Normalize date from device to MySQL datetime format
   * Handles Unix timestamps (seconds or milliseconds) and string dates
   */
  private normalizeDate(dateInput: any): string {
    if (!dateInput) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Check if it's a Unix timestamp (only if it's actually a number type, not string of digits)
    if (typeof dateInput === 'number') {
      // If it's after year 2000, it's a valid timestamp
      if (dateInput > 946684800) { // Jan 1, 2000
        // Convert seconds to milliseconds if needed
        const ms = dateInput > 1000000000000 ? dateInput : dateInput * 1000;
        return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    
    // Try parsing as standard date string
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    // Fallback to current time
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  // Private helper methods

  private formatTime(dateInput: Date | string): string {
    try {
      const date = this.parsePunchTime(dateInput);
      if (isNaN(date.getTime())) {
        return '--:--';
      }
      return date.toTimeString().slice(0, 5); // HH:MM
    } catch (e) {
      return '--:--';
    }
  }

  private calculateLateMinutes(punchTime: Date | string, standardStartTime: string): number {
    try {
      const punch = this.parsePunchTime(punchTime);
      if (isNaN(punch.getTime())) {
        return 0;
      }
      const [stdHour, stdMin] = standardStartTime.split(':').map(Number);
      const stdMinutes = stdHour * 60 + stdMin;
      const punchMinutes = punch.getHours() * 60 + punch.getMinutes();
      
      return Math.max(0, punchMinutes - stdMinutes);
    } catch (e) {
      return 0;
    }
  }

  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * Calculate late time for CSV import based on employee shift policy
   * Returns late time string (e.g., "00:30") or empty string if not late
   * 
   * Logic:
   * 1. Get employee's shift for the date (from assignment or policy)
   * 2. Get shift start time + grace period
   * 3. Compare actual clock-in time against shift start + grace
   * 4. Return late duration if clock-in is after grace period
   */
  private async calculateLateForCsvImport(empCode: string, dateStr: string, clockIn: string, empName?: string): Promise<string> {
    if (!clockIn || !clockIn.trim()) return '';
    
    try {
      const clockTime = this.parseClockTimeString(clockIn);
      if (!clockTime) {
        console.log(`[CSV Import] Invalid clock-in format for ${empCode}: ${clockIn}`);
        return '';
      }

      // Get shift start time with grace period already added (pass name for fallback matching)
      const shiftStartWithGrace = await this.getEmployeeShiftStartTime(empCode, new Date(dateStr), empName);
      
      // Parse shift start time (already includes grace)
      const [shiftHour, shiftMin] = shiftStartWithGrace.split(':').map(Number);
      const shiftMinutes = shiftHour * 60 + shiftMin;
      const clockMinutes = clockTime.hour * 60 + clockTime.minute;
      
      // Calculate late minutes
      const lateMinutes = Math.max(0, clockMinutes - shiftMinutes);
      
      console.log(`[CSV Late Calc] ${empCode} on ${dateStr}: clockIn=${clockIn} (${clockMinutes}m), shiftWithGrace=${shiftStartWithGrace} (${shiftMinutes}m), late=${lateMinutes}m`);
      
      if (lateMinutes > 0) {
        return this.minutesToTimeString(lateMinutes);
      }
      return '';
    } catch (error) {
      console.error(`[CSV Import] Error calculating late for ${empCode} on ${dateStr}:`, error);
      return '';
    }
  }

  /**
   * Recalculate late for Job Card based on current policy (real-time calculation)
   * This ensures late is calculated based on CURRENT policy, not stored value
   */
  private async recalculateLateForJobCard(
    clockIn: string, 
    currentPolicyRule: string
  ): Promise<{ late: string; lateMinutes: number }> {
    if (!clockIn || !clockIn.trim()) return { late: '', lateMinutes: 0 };
    
    try {
      // Get shift from current policy
      const shift = await this.getShiftFromPolicyRule(currentPolicyRule);
      if (!shift) return { late: '', lateMinutes: 0 };
      
      // Calculate threshold (shift start + grace)
      const [shiftHour, shiftMin] = shift.start_time.split(':').map(Number);
      const totalMinutesWithGrace = shiftHour * 60 + shiftMin + shift.grace_period_minutes;
      const thresholdHour = Math.floor(totalMinutesWithGrace / 60) % 24;
      const thresholdMin = totalMinutesWithGrace % 60;
      
      // Parse clock-in
      const [clockHour, clockMin] = clockIn.split(':').map(Number);
      const clockMinutes = clockHour * 60 + clockMin;
      const thresholdMinutes = thresholdHour * 60 + thresholdMin;
      
      // Calculate late
      const lateMinutes = Math.max(0, clockMinutes - thresholdMinutes);
      
      if (lateMinutes > 0) {
        const hours = Math.floor(lateMinutes / 60);
        const mins = lateMinutes % 60;
        return { 
          late: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
          lateMinutes 
        };
      }
      
      return { late: '', lateMinutes: 0 };
    } catch (error) {
      return { late: '', lateMinutes: 0 };
    }
  }

  /**
   * Parse shift start time from policy rule string
   * Format: "Morning Shift (8 A - 4 PM)" or "Morning Shift (8 AM - 4 PM)"
   */
  private parseShiftTimeFromPolicy(policyRule: string): { startTime: string; shiftName: string } | null {
    if (!policyRule || policyRule === 'N/A') return null;
    
    // Extract time from parentheses: (8 A - 4 PM) or (8 AM - 4 PM) or (11PM - 8 AM)
    // Handle variations: "8 A", "8 AM", "11PM" (with or without space, with or without M)
    const timeMatch = policyRule.match(/\((\d+)\s*([AP]?)M?\s*-\s*(\d+)\s*([AP])M\)/i);
    if (!timeMatch) return null;
    
    let startHour = parseInt(timeMatch[1], 10);
    const startPeriod = timeMatch[2]; // A, P, or undefined
    
    // Convert to 24-hour format
    if (startPeriod?.toUpperCase() === 'P' && startHour !== 12) {
      startHour += 12;
    } else if (startPeriod?.toUpperCase() === 'A' && startHour === 12) {
      startHour = 0;
    }
    
    // Extract shift name (text before the parentheses)
    const shiftName = policyRule.split('(')[0].trim();
    
    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    return { startTime, shiftName };
  }

  /**
   * Get shift details from database by matching policy rule to shift_name
   * Now queries by exact shift_name match (e.g., "Morning Shift (8 A - 4 PM)")
   * 
   * Uses EXACT shift names from the database that match policy dropdown
   */
  private async getShiftFromPolicyRule(policyRule: string): Promise<{ start_time: string; grace_period_minutes: number; shift_code: string; shift_name: string } | null> {
    if (!policyRule || policyRule === 'N/A') return null;
    
    try {
      // Normalize the policy rule for matching (trim spaces, standardize case)
      const normalizedPolicy = policyRule.trim();
      
      // Try exact match on shift_name first
      const [exactMatch] = await this.db.execute(
        `SELECT shift_code, start_time, grace_period_minutes, shift_name
         FROM shifts 
         WHERE shift_name = ? AND is_active = TRUE 
         LIMIT 1`,
        [normalizedPolicy]
      );
      
      const exactShifts = exactMatch as any[];
      if (exactShifts.length > 0) {
        console.log(`[Shift] Exact match: "${normalizedPolicy}" -> ${exactShifts[0].shift_name} (${exactShifts[0].start_time} + ${exactShifts[0].grace_period_minutes}min grace)`);
        return {
          shift_code: exactShifts[0].shift_code,
          shift_name: exactShifts[0].shift_name,
          start_time: exactShifts[0].start_time,
          grace_period_minutes: exactShifts[0].grace_period_minutes || 45,
        };
      }
      
      // Try normalized match (remove extra spaces around parentheses)
      // "General shift ( 10 AM - 6 PM)" -> "General shift (10 AM - 6 PM)"
      // "Morning Shift (8 A - 4 PM )" -> "Morning Shift (8 A - 4 PM)"
      const compactPolicy = normalizedPolicy.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
      if (compactPolicy !== normalizedPolicy) {
        const [compactMatch] = await this.db.execute(
          `SELECT shift_code, start_time, grace_period_minutes, shift_name
           FROM shifts 
           WHERE shift_name = ? AND is_active = TRUE 
           LIMIT 1`,
          [compactPolicy]
        );
        
        const compactShifts = compactMatch as any[];
        if (compactShifts.length > 0) {
          console.log(`[Shift] Compact match: "${normalizedPolicy}" -> "${compactPolicy}" -> ${compactShifts[0].shift_name} (${compactShifts[0].start_time} + ${compactShifts[0].grace_period_minutes}min grace)`);
          return {
            shift_code: compactShifts[0].shift_code,
            shift_name: compactShifts[0].shift_name,
            start_time: compactShifts[0].start_time,
            grace_period_minutes: compactShifts[0].grace_period_minutes || 45,
          };
        }
      }
      
      // Try with time pattern matching - extract shift type and match
      // "Morning Shift (8 A - 4 PM )" -> try matching "Morning Shift%"
      const shiftType = normalizedPolicy.split('(')[0].trim();
      
      // First: Try exact shift type match with wildcard for time
      const [typeMatch] = await this.db.execute(
        `SELECT shift_code, start_time, grace_period_minutes, shift_name
         FROM shifts 
         WHERE shift_name LIKE ? AND is_active = TRUE 
         LIMIT 1`,
        [`${shiftType}%`]
      );
      
      const typeShifts = typeMatch as any[];
      if (typeShifts.length > 0) {
        console.log(`[Shift] Type match: "${normalizedPolicy}" (type: "${shiftType}%") -> ${typeShifts[0].shift_name} (${typeShifts[0].start_time} + ${typeShifts[0].grace_period_minutes}min grace)`);
        return {
          shift_code: typeShifts[0].shift_code,
          shift_name: typeShifts[0].shift_name,
          start_time: typeShifts[0].start_time,
          grace_period_minutes: typeShifts[0].grace_period_minutes || 45,
        };
      }
      
      // Fallback: Try broader pattern match on shift_name
      const [patternMatch] = await this.db.execute(
        `SELECT shift_code, start_time, grace_period_minutes, shift_name
         FROM shifts 
         WHERE shift_name LIKE ? AND is_active = TRUE 
         LIMIT 1`,
        [`%${shiftType}%`]
      );
      
      const patternShifts = patternMatch as any[];
      if (patternShifts.length > 0) {
        console.log(`[Shift] Pattern match: "${normalizedPolicy}" (type: "%${shiftType}%") -> ${patternShifts[0].shift_name} (${patternShifts[0].start_time} + ${patternShifts[0].grace_period_minutes}min grace)`);
        return {
          shift_code: patternShifts[0].shift_code,
          shift_name: patternShifts[0].shift_name,
          start_time: patternShifts[0].start_time,
          grace_period_minutes: patternShifts[0].grace_period_minutes || 45,
        };
      }
      
      console.log(`[Shift] No shift found matching policy: "${normalizedPolicy}"`);
      return null;
    } catch (error) {
      console.error('[Shift] Error looking up shift from policy rule:', error);
      return null;
    }
  }

  /**
   * Get employee shift start time with fallback hierarchy:
   * 1. Check specific date assignment in employee_shift_assignments
   * 2. Check employee_policy_tagging shift_policy_rule (parse from text like "Morning Shift (8 AM - 4 PM)")
   * 3. Return default 10:45 (General shift 10:00 + 45 min grace)
   */
  private async getEmployeeShiftStartTime(empCode: string, date: Date, empName?: string): Promise<string> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // 1. Check explicit shift assignment for this specific date
      // Wrap in try-catch in case employee_shift_assignments table doesn't exist
      try {
        const [assignment] = await this.db.execute(
          `SELECT s.start_time, s.grace_period_minutes, s.shift_code
           FROM employee_shift_assignments esa
           JOIN shifts s ON s.id = esa.shift_id
           WHERE esa.emp_code = ? 
             AND esa.assignment_date = ?
             AND esa.is_off_day = FALSE
             AND s.is_active = TRUE`,
          [empCode, dateStr]
        );
        
        const assignments = assignment as any[];
        if (assignments.length > 0) {
          const shift = assignments[0];
          // Add grace period to shift start time
          const [hours, minutes] = shift.start_time.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + (shift.grace_period_minutes || 45);
          const finalHours = Math.floor(totalMinutes / 60) % 24;
          const finalMinutes = totalMinutes % 60;
          const startTimeStr = `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
          console.log(`[Shift] ${empCode} on ${dateStr}: Specific assignment - ${shift.shift_code} (${shift.start_time} + ${shift.grace_period_minutes}min grace) = ${startTimeStr}`);
          return startTimeStr;
        }
      } catch (tableError: any) {
        // Table doesn't exist or other error - silently skip to next method
        if (tableError.code === 'ER_NO_SUCH_TABLE') {
          console.log(`[Shift] employee_shift_assignments table not found, skipping to policy lookup`);
        } else {
          console.log(`[Shift] Error checking shift assignments: ${tableError.message}`);
        }
      }
      
      // 2. Check employee_policy_tagging for default shift assignment
      // Try multiple emp_code variations to handle format mismatches
      // E0015 -> try: E0015, EMP0015, 0015, 15
      const variations = [empCode];
      
      // Add EMP prefix version (E0015 -> EMPE0015 or 0015 -> EMP0015)
      if (empCode.startsWith('E') && /^E\d+$/i.test(empCode)) {
        variations.push(`EMP${empCode}`);       // E0015 -> EMPE0015
        variations.push(`EMP${empCode.substring(1)}`); // E0015 -> EMP0015
        variations.push(empCode.substring(1));   // E0015 -> 0015
        variations.push(String(parseInt(empCode.substring(1), 10))); // E0015 -> 15
      } else if (!empCode.startsWith('EMP')) {
        variations.push(`EMP${empCode}`);        // 0015 -> EMP0015
        variations.push(`E${empCode}`);          // 0015 -> E0015
      }
      
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  SHIFT LOOKUP: ${empCode} on ${dateStr}                      ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝`);
      console.log(`  Employee Name: ${empName || 'N/A'}`);
      console.log(`  Code Variations: [${variations.join(', ')}]`);
      
      // Try each variation until we find a policy
      let policy: any = null;
      let matchedCode: string | null = null;
      
      // Step 1: Find employee in csv_employees by `AC-No.`
      console.log(`\n  ── Step 1: Find employee in csv_employees ──`);
      let csvEmployee: any = null;
      
      // Try by `AC-No.` (PRIMARY KEY)
      for (const codeVar of variations) {
        if (!codeVar) continue;
        try {
          const [csvEmpResult] = await this.db.execute(
            `SELECT \`AC-No.\`, Department FROM csv_employees WHERE \`AC-No.\` = ?`,
            [codeVar]
          );
          const csvEmps = csvEmpResult as any[];
          if (csvEmps.length > 0) {
            csvEmployee = csvEmps[0];
            console.log(`     ✓ Found by AC-No.: ${csvEmployee['AC-No.']}`);
            break;
          }
        } catch (e: any) {
          console.log(`     ✗ AC-No. lookup error: ${e.message}`);
        }
      }
      
      if (!csvEmployee) {
        console.log(`     ✗ Employee NOT found in csv_employees table`);
      }
      
      // Step 2: Look up policy using `AC-No.` (primary lookup key)
      if (csvEmployee) {
        console.log(`\n  ── Step 2: Check policy for AC-No. = ${csvEmployee['AC-No.']} ──`);
        try {
          const [csvLinkResult] = await this.db.execute(
            `SELECT shift_policy_rule, \`AC-No.\`
             FROM employee_policy_tagging
             WHERE \`AC-No.\` = ?
               AND shift_policy_rule IS NOT NULL 
               AND shift_policy_rule != ''
               AND shift_policy_rule != 'N/A'
             ORDER BY id DESC 
             LIMIT 1`,
            [csvEmployee['AC-No.']]
          );
          
          const csvPolicies = csvLinkResult as any[];
          if (csvPolicies.length > 0) {
            policy = csvPolicies[0];
            matchedCode = csvPolicies[0]['AC-No.'];
            console.log(`     ✓ POLICY FOUND using AC-No.:`);
            console.log(`       AC-No.: ${matchedCode}`);
            console.log(`       Shift: ${policy.shift_policy_rule}`);
          } else {
            console.log(`     ✗ No policy found for AC-No.: ${csvEmployee['AC-No.']}`);
          }
        } catch (csvError: any) {
          console.log(`     ✗ Error: ${csvError.message}`);
        }
      }
      
      if (!policy) {
        console.log(`\n  ⚠️  NO POLICY FOUND in csv_employees linkage`);
      }
      
      if (policy) {
        console.log(`\n  ── Step 4: Match shift from policy ──`);
        // 2. Try exact match with shift_name
        const shift = await this.getShiftFromPolicyRule(policy.shift_policy_rule);
        
        if (shift) {
          const graceMinutes = shift.grace_period_minutes || 45;
          // Add grace period to start time
          const [startHour, startMin] = shift.start_time.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const totalMinutes = startMinutes + graceMinutes;
          const finalHours = Math.floor(totalMinutes / 60) % 24;
          const finalMinutes = totalMinutes % 60;
          const startTimeStr = `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
          console.log(`     ✓ SHIFT MATCHED:`);
          console.log(`       Shift Name: ${shift.shift_name}`);
          console.log(`       Start Time: ${shift.start_time} + ${graceMinutes}min grace = ${startTimeStr}`);
          console.log(`\n  ══════════════════════════════════════════════════════════════`);
          console.log(`  FINAL RESULT:`);
          console.log(`    Employee: ${empCode}`);
          console.log(`    Date: ${dateStr}`);
          console.log(`    Shift Start Time: ${startTimeStr}`);
          console.log(`    Policy: ${policy.shift_policy_rule}`);
          console.log(`    Matched Shift: ${shift.shift_name}`);
          console.log(`    Grace Period: ${graceMinutes} minutes`);
          console.log(`\n  ══════════════════════════════════════════════════════════════`);
          return startTimeStr;
        } else {
          console.log(`     ✗ Could not match shift from policy: ${policy.shift_policy_rule}`);
          // 5. Fallback: Parse time from policy text
          const parsed = this.parseShiftTimeFromPolicy(policy.shift_policy_rule);
          if (parsed) {
            const graceMinutes = 45; // Default grace
            const [startHour, startMin] = parsed.startTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const totalMinutes = startMinutes + graceMinutes;
            const finalHours = Math.floor(totalMinutes / 60) % 24;
            const finalMinutes = totalMinutes % 60;
            const startTimeStr = `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
            console.log(`[Shift] ${empCode} on ${dateStr}: Parsed from text - ${parsed.shiftName} (${parsed.startTime} + ${graceMinutes}min grace) = ${startTimeStr}`);
            return startTimeStr;
          }
        }
      } else {
        console.log(`[Shift] No policy found for ${empCode} (tried: ${variations.join(', ')}) on ${dateStr}`);
        
        // 6. Ultimate fallback - General shift 10:00 + 45 min grace = 10:45
        console.log(`[Shift] ${empCode} on ${dateStr}: No shift assigned, using default 10:45 (General shift)`);
        return '10:45';
      }
      
      // 6. Ultimate fallback - General shift 10:00 + 45 min grace = 10:45
      console.log(`[Shift] ${empCode} on ${dateStr}: No shift assigned, using default 10:45 (General shift)`);
      return '10:45';

    } catch (error) {
      console.error(`[Shift] Error getting shift start time for ${empCode}:`, error);
      // Fallback to default on error - General shift 10:00 + 45 min grace = 10:45
      return '10:45';
    }
  }

  /**
   * Check if employee has duty roster policy enabled
   * Returns the roster policy rule if set, null otherwise
   */
  async getEmployeeRosterPolicy(empCode: string): Promise<string | null> {
    try {
      const [policy] = await this.db.execute(
        `SELECT duty_roster_policy_rule 
         FROM employee_policy_tagging 
         WHERE emp_code = ? 
           AND duty_roster_policy_rule IS NOT NULL
           AND duty_roster_policy_rule != ''
           AND duty_roster_policy_rule != 'NO_ROSTER'
         ORDER BY duty_roster_policy_date DESC
         LIMIT 1`,
        [empCode]
      );
      
      const policies = policy as any[];
      if (policies.length > 0) {
        return policies[0].duty_roster_policy_rule;
      }
      return null;
    } catch (error) {
      console.error(`[Roster] Error checking roster policy for ${empCode}:`, error);
      return null;
    }
  }

  /**
   * Get shift details by code
   */
  private async getShiftByCode(shiftCode: string): Promise<any | null> {
    try {
      const [result] = await this.db.execute(
        `SELECT * FROM shifts WHERE shift_code = ? AND is_active = TRUE`,
        [shiftCode]
      );
      const shifts = result as any[];
      return shifts.length > 0 ? shifts[0] : null;
    } catch (error) {
      console.error(`[Shift] Error getting shift ${shiftCode}:`, error);
      return null;
    }
  }

  private parsePunchTime(punchTime: any): Date {
    if (!punchTime) return new Date();
    
    // If it's already a Date object
    if (punchTime instanceof Date) {
      return isNaN(punchTime.getTime()) ? new Date() : punchTime;
    }
    
    const str = punchTime.toString().trim();
    
    // Check if it's a Unix timestamp (all digits)
    if (/^\d+$/.test(str)) {
      const num = parseInt(str, 10);
      // If it's a reasonable timestamp (after year 2000)
      if (num > 946684800) { // Jan 1, 2000
        // Check if it's seconds or milliseconds
        const ms = num > 1000000000000 ? num : num * 1000;
        return new Date(ms);
      }
    }
    
    // Try standard date parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // Try extracting from string like "Sat Mar 07 2026 16:40:21 GMT+0600"
    const dateMatch = str.match(/\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
    if (dateMatch) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [, monthStr, day, year] = dateMatch;
      const monthNum = monthNames.indexOf(monthStr) + 1;
      if (monthNum > 0) {
        return new Date(`${year}-${String(monthNum).padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
    }
    
    return new Date();
  }

  private parseClockTimeString(timeValue: string): { hour: number; minute: number } | null {
    if (!timeValue) return null;
    const raw = timeValue.toString().trim();
    if (raw === '') return null;

    const normalized = raw.replace(/\./g, '').replace(/\s+/g, ' ').toUpperCase();

    // HH:MM or HH:MM:SS
    let match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return { hour, minute };
      }
    }

    // 12-hour format with AM/PM
    match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (match) {
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const period = match[4];
      if (hour === 12) {
        hour = period === 'AM' ? 0 : 12;
      } else if (period === 'PM') {
        hour += 12;
      }
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return { hour, minute };
      }
    }

    // 12-hour format without minutes
    match = normalized.match(/^(\d{1,2})\s*(AM|PM)$/);
    if (match) {
      let hour = Number(match[1]);
      const period = match[2];
      if (hour === 12) {
        hour = period === 'AM' ? 0 : 12;
      } else if (period === 'PM') {
        hour += 12;
      }
      if (hour >= 0 && hour < 24) {
        return { hour, minute: 0 };
      }
    }

    return null;
  }

  private async loadFromRealtimeLogs(dto: SearchAttendanceDto): Promise<AttendanceDisplayRecord[]> {
    const searchTerms = dto.search ? dto.search.split(',').map(s => s.trim()).filter(s => s) : [];
    
    let query = `
      SELECT 
        rtl.*,
        ce.\`AC-No.\` as ac_no,
        ce.Department as department
      FROM real_time_logs rtl
      LEFT JOIN csv_employees ce ON ce.\`AC-No.\` = rtl.\`AC-No.\`
      WHERE 1=1
    `;
    const params: any[] = [];

    if (searchTerms.length > 0) {
      query += ` AND (`;
      query += searchTerms.map(() => {
        if (dto.searchType === 'acc_no') return `rtl.\`AC-No.\` = ?`;
        return `(rtl.\`AC-No.\` LIKE ? OR rtl.\`Name\` LIKE ?)`;
      }).join(' OR ');
      query += `)`;
      
      for (const term of searchTerms) {
        if (dto.searchType === 'acc_no') {
          params.push(term);
        } else {
          params.push(`%${term}%`, `%${term}%`);
        }
      }
    }

    // Remove date filtering since punch_time column doesn't exist
    // if (dto.fromDate && dto.toDate) {
    //   query += ` AND DATE(rtl.punch_time) >= ? AND DATE(rtl.punch_time) <= ?`;
    //   params.push(dto.fromDate, dto.toDate);
    // }

    query += ` ORDER BY rtl.id DESC`;

    const [rows] = await this.db.execute(query, params);
    const logs = rows as any[];

    // Group by employee and date to create daily records
    const dailyMap: Record<string, any> = {};
    
    for (const log of logs) {
      if (!log) continue;
      const empCode = log['No.'] || log['AC-No.'];
      
      // Since there's no punch_time column, use current date
      const date = new Date().toISOString().split('T')[0];
      
      const key = `${empCode}_${date}`;
      
      if (!dailyMap[key]) {
        dailyMap[key] = {
          empNo: log['Emp No.'] || '',
          acNo: log['AC-No.'],
          no: log['No.'] || log['AC-No.'],
          name: log['Name'] || 'Unknown',
          date: date,
          punches: [],
          department: log.department || '',
        };
      }
      
      dailyMap[key].punches.push(log);
    }

    // Convert to display records
    return Object.values(dailyMap).map((day: any) => {
      // Sort by ID since there's no punch_time column
      day.punches.sort((a: any, b: any) => {
        return (a.id || 0) - (b.id || 0);
      });
      
      const firstPunch = day.punches[0];
      const lastPunch = day.punches[day.punches.length - 1];
      
      // Since there's no punch_time, use placeholder times
      const inTime = '--:--';
      const outTime = '--:--';
      
      // Set late to empty since we can't calculate without punch_time
      const late = '';
      
      return {
        status: 'Present' as const,
        empNo: day.empNo,
        acNo: day.acNo,
        no: day.no,
        name: day.name,
        date: day.date,
        clockIn: inTime,
        clockOut: outTime,
        late,
        department: day.department,
      };
    });
  }

  private async loadFromLogsTable(dto: SearchAttendanceDto): Promise<string[][]> {
    // For job cards and monthly views, use logs table with calculated data
    const isJobCard = dto.view === 'job_card';
    const isMonthly = dto.view === 'monthly';

    // Query logs table with calculated fields (now includes all attendance data)
    // This includes late, actual_late, policies, gross_salary, shift info
    // Join with csv_employees to get all 4 identity fields
    let logsQuery = `
      SELECT
        COALESCE(l.\`Status\`, 'Present') as status,
        l.emp_id,
        l.\`AC-No.\` as ac_no,
        -- Get all 4 identity fields from csv_employees (source of truth)
        COALESCE(ce.\`Emp No.\`, l.\`Emp No.\`, '') as emp_no,
        COALESCE(ce.\`No.\`, l.\`No.\`, l.emp_id, '') as no,
        COALESCE(ce.\`Name\`, l.\`Name\`, '') as name,
        COALESCE(l.\`Auto-Assign\`, '') as auto_assign,
        -- Use attendance_date if available, otherwise convert from Date
        COALESCE(l.attendance_date,
          CASE
            WHEN l.\`Date\` LIKE '%/%/%'
            THEN STR_TO_DATE(l.\`Date\`, '%m/%d/%Y')
            ELSE l.\`Date\`
          END
        ) as date,
        COALESCE(l.\`Timetable\`, '') as timetable,
        COALESCE(l.shift_start_time,
          CASE
            WHEN UPPER(l.shift_code) LIKE '%MORNING%' THEN '08:00:00'
            WHEN UPPER(l.shift_code) LIKE '%EVENING%' THEN '15:00:00'
            WHEN UPPER(l.shift_code) LIKE '%NIGHT%' THEN '23:00:00'
            WHEN UPPER(l.shift_code) LIKE '%GENERAL%' THEN '10:00:00'
            WHEN UPPER(l.shift_code) LIKE '%RAMADAN%' THEN '09:00:00'
            ELSE COALESCE(l.\`On duty\`, '09:00')
          END
        ) as on_duty,
        COALESCE(s.end_time, l.\`Off duty\`, '18:00') as off_duty,
        l.\`Clock In\` as clock_in,
        l.\`Clock Out\` as clock_out,
        COALESCE(l.\`Normal\`, '') as normal,
        COALESCE(l.\`Real time\`, '') as real_time,
        -- Use stored calculated values from logs table
        COALESCE(l.calculated_late, l.\`Late\`, '') as late,
        COALESCE(l.late_minutes, 0) as late_minutes,
        COALESCE(l.\`Early\`, '') as early,
        COALESCE(l.\`Absent\`, '') as absent,
        COALESCE(l.\`OT Time\`, '') as ot_time,
        COALESCE(l.\`Work Time\`, '') as work_time,
        COALESCE(l.\`Exception\`, '') as exception,
        COALESCE(l.\`Must C/In\`, '') as must_cin,
        COALESCE(l.\`Must C/Out\`, '') as must_cout,
        COALESCE(l.\`Department\`, ce.Department, '') as department,
        COALESCE(l.\`NDays\`, '') as ndays,
        COALESCE(l.\`WeekEnd\`, '') as weekend,
        COALESCE(l.\`Holiday\`, '') as holiday,
        COALESCE(l.\`ATT_Time\`, '') as att_time,
        COALESCE(l.\`NDays_OT\`, '') as ndays_ot,
        COALESCE(l.\`WeekEnd_OT\`, '') as weekend_ot,
        COALESCE(l.\`Holiday_OT\`, '') as holiday_ot,
        -- Policy and calculated fields for job cards/salary sheet
        COALESCE(l.late_deduction_policy, '') as late_deduction_policy,
        COALESCE(l.absent_deduction_policy, '') as absent_deduction_policy,
        COALESCE(l.gross_salary, 0) as gross_salary,
        COALESCE(l.shift_code, '') as shift_code,
        COALESCE(l.shift_grace_minutes, 15) as shift_grace_minutes,
        COALESCE(l.actual_absent, 0) as actual_absent,
        COALESCE(l.late_count, 0) as late_count,
        COALESCE(l.late_deduction_days, 0) as late_deduction_days,
        COALESCE(l.absent_deduction_amount, 0) as absent_deduction_amount,
        -- Get current policy from employee_policy_tagging (real-time, no sync needed)
        COALESCE(ept.shift_policy_rule, 'General shift (10 AM - 6 PM)') as current_shift_policy,
        COALESCE(ept.late_deduction_policy_rule, 'N/A') as current_late_policy,
        COALESCE(ept.absent_deduction_policy_rule, 'N/A') as current_absent_policy
      FROM logs l
      -- Join with csv_employees to get all 4 identity fields
      LEFT JOIN csv_employees ce ON ce.\`AC-No.\` = l.\`AC-No.\`
      -- Join shifts by shift_code
      LEFT JOIN shifts s ON s.shift_code = l.shift_code AND s.is_active = TRUE
      -- Join employee_policy_tagging to get CURRENT policy (real-time)
      LEFT JOIN employee_policy_tagging ept ON ept.\`AC-No.\` = l.\`AC-No.\`
      WHERE 1=1
    `;
    let logsParams: any[] = [];

    // Handle search by different types
    if (dto.search) {
      const searchTerm = `%${dto.search}%`;
      switch (dto.searchType) {
        case 'acc_no':
          // Exact match for AC-No.
          logsQuery += ` AND l.\`AC-No.\` = ?`;
          logsParams.push(dto.search);
          break;
        case 'name':
        default:
          // Search by Name (from csv_employees or logs)
          logsQuery += ` AND (ce.\`Name\` LIKE ? OR l.\`Name\` LIKE ?)`;
          logsParams.push(searchTerm, searchTerm);
          break;
      }
    }

    if (dto.fromDate && dto.toDate) {
      logsQuery += ` AND COALESCE(l.attendance_date, STR_TO_DATE(l.\`Date\`, '%m/%d/%Y')) BETWEEN ? AND ?`;
      logsParams.push(dto.fromDate, dto.toDate);
    }

    // Execute the query
    const [logsResult] = await this.db.execute(logsQuery, logsParams);
    const logsRows = logsResult as any[];

    const logsRowsWithCurrentPolicy = await Promise.all(logsRows.map(async (row: any) => {
      if (row.current_shift_policy && row.clock_in) {
        const lateCalc = await this.recalculateLateForJobCard(row.clock_in, row.current_shift_policy);
        row.late = lateCalc.late || row.late;
        row.late_minutes = lateCalc.lateMinutes || row.late_minutes;
      }
      return row;
    }));

    // Helper to convert date from M/D/YYYY to YYYY-MM-DD
    const convertDate = (dateStr: string): string => {
      if (!dateStr) return '';
      // Check if format is M/D/YYYY or MM/DD/YYYY
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      return dateStr; // Already in YYYY-MM-DD format
    };

    const formatRow = (row: any, convertDates = false) => [
      row.status,
      row.emp_no || '',                     // empNo (index 1)
      row.ac_no || '',                     // acNo (index 2)
      row.no || '',                        // no (index 3)
      row.name || '',                      // name (index 4)
      row.auto_assign,
      convertDates ? convertDate(row.date) : row.date,
      row.timetable, row.on_duty, row.off_duty, row.clock_in, row.clock_out,
      row.normal, row.real_time, row.late, row.early, row.absent, row.ot_time,
      row.work_time, row.exception, row.must_cin, row.must_cout, row.department,
      row.ndays, row.weekend, row.holiday, row.att_time, row.ndays_ot, row.weekend_ot, row.holiday_ot,
      // New policy columns from real-time join with employee_policy_tagging
      row.current_shift_policy, row.current_late_policy, row.current_absent_policy
    ];

    let logsRecords = logsRows.map(row => formatRow(row, true));

    // Filter logs by date in JS if date range specified
    if (dto.fromDate && dto.toDate) {
      logsRecords = logsRecords.filter(rec => {
        const date = rec[6]; // date column
        return date >= dto.fromDate && date <= dto.toDate;
      });
    }

    // All views now use logs table only (which has all calculated fields)
    let combined: string[][] = logsRecords;

    // Sort by date desc, then emp_id
    combined.sort((a, b) => {
      const dateA = a[6] || '';
      const dateB = b[6] || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (a[3] || '').localeCompare(b[3] || '');
    });

    return combined;
  }

  // Reuse existing helper methods from old service
  private groupByEmployee(records: string[][]): Record<string, { empNo: string; acNo: string; no: string; name: string; dept: string; records: string[][] }> {
    const groups: Record<string, any> = {};

    for (const rec of records) {
      const no = rec[3]; // `No.` column - used as key
      if (!groups[no]) {
        groups[no] = {
          empNo: rec[1] || '-',  // `Emp No.` column
          acNo: rec[2] || '-',   // `AC-No.` column
          no: rec[3] || '-',     // `No.` column
          name: rec[4] || '-',   // `Name` column
          dept: rec[22] || '-',  // Department column
          records: [],
        };
      }
      groups[no].records.push(rec);
    }

    return groups;
  }

  private calculateJobCardSummary(records: string[][], fromDate?: string, toDate?: string): JobCardSummary {
    const dates = records.map(r => this.parseDate(r[6])).filter(d => d) as string[];
    const effectiveFromDate = fromDate && fromDate.trim() ? fromDate : undefined;
    const effectiveToDate = toDate && toDate.trim() ? toDate : undefined;
    const calcFrom = effectiveFromDate || (dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : new Date().toISOString().split('T')[0]);
    const calcTo = effectiveToDate || (dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : new Date().toISOString().split('T')[0]);

    const start = new Date(calcFrom);
    const end = new Date(calcTo);
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const dateIndex: Record<string, string[]> = {};
    for (const rec of records) {
      const date = this.parseDate(rec[6]);
      if (date) dateIndex[date] = rec;
    }

    let weekend = 0, workingDays = 0, absent = 0, present = 0, late = 0, earlyOut = 0;

    console.log(`[JobCardSummary] Processing ${records.length} records from ${calcFrom} to ${calcTo}`);
    let lateDebugCount = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const isFriday = dayOfWeek === 5;

      if (dateIndex[dateKey]) {
        const rec = dateIndex[dateKey];
        const isPresent = rec[0] === 'Present';
        const empCode = rec[3];
        const lateValue = rec[14]; // calculated_late (policy-based) at index 14

        if (isFriday) {
          weekend++;
          if (isPresent) present++;
        } else {
          workingDays++;
          if (isPresent) {
            present++;
            // Count late if rec[14] (calculated_late column) has a value and it's not empty/zero
            if (lateValue && lateValue.trim() !== '' && lateValue !== '00:00' && lateValue !== '0:00') {
              late++;
              if (lateDebugCount < 10) {
                console.log(`[JobCardSummary] ${empCode} on ${dateKey}: calculatedLate="${lateValue}" -> LATE. Present=${present}, Late=${late}`);
                lateDebugCount++;
              }
            } else if (lateDebugCount < 10) {
              console.log(`[JobCardSummary] ${empCode} on ${dateKey}: calculatedLate="${lateValue}" -> ON TIME. Present=${present}`);
              lateDebugCount++;
            }
          } else {
            absent++;
          }
        }
      } else if (isFriday) {
        weekend++;
      } else {
        absent++;
        workingDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    console.log(`[JobCardSummary] Final summary: Present=${present}, Late=${late}, Absent=${absent}, WorkingDays=${workingDays}`);

    return {
      totalDays,
      weekend,
      workingDays,
      absent,
      present,
      late,
      earlyOut,
      payableDays: totalDays - absent,
    };
  }

  private buildDailyRecords(records: string[][], fromDate?: string, toDate?: string): JobCardDailyRecord[] {
    const dates = records.map(r => this.parseDate(r[6])).filter(d => d) as string[];
    const effectiveFromDate = fromDate && fromDate.trim() ? fromDate : undefined;
    const effectiveToDate = toDate && toDate.trim() ? toDate : undefined;
    const calcFrom = effectiveFromDate || (dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : new Date().toISOString().split('T')[0]);
    const calcTo = effectiveToDate || (dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : new Date().toISOString().split('T')[0]);

    const dateIndex: Record<string, string[]> = {};
    for (const rec of records) {
      const date = this.parseDate(rec[6]);
      if (date) dateIndex[date] = rec;
    }

    const dailyRecords: JobCardDailyRecord[] = [];
    const start = new Date(calcFrom);
    const end = new Date(calcTo);
    const current = new Date(start);

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const dayName = current.toLocaleDateString('en', { weekday: 'short' });
      const isFriday = current.getDay() === 5;
      const hasRecord = dateIndex[dateKey];

      if (hasRecord) {
        const rec = dateIndex[dateKey];
        const isPresent = rec[0] === 'Present';
        dailyRecords.push({
          date: dateKey,
          day: isFriday && !isPresent ? 'Fri (Off)' : dayName,
          inTime: rec[10] || '-',
          outTime: rec[11] || '-',
          late: rec[14] || '-',
          status: rec[0],
          isFriday,
          isPresent,
        });
      } else if (isFriday) {
        dailyRecords.push({
          date: dateKey,
          day: 'Fri (Off)',
          inTime: '-',
          outTime: '-',
          late: '-',
          status: 'OFF',
          isFriday: true,
          isPresent: false,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return dailyRecords;
  }

  private getMonthSegments(fromDate?: string, toDate?: string): { year: number; month: string; ym: string }[] {
    const now = new Date();
    const effectiveFromDate = fromDate && fromDate.trim() ? fromDate : undefined;
    const effectiveToDate = toDate && toDate.trim() ? toDate : undefined;
    const start = effectiveFromDate ? new Date(effectiveFromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = effectiveToDate ? new Date(effectiveToDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const segments: { year: number; month: string; ym: string }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      segments.push({
        year: current.getFullYear(),
        month: current.toLocaleDateString('en', { month: 'long' }),
        ym: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return segments;
  }

  private buildMonthlyDaysData(records: string[][], ym: string): any[] {
    const year = parseInt(ym.split('-')[0]);
    const month = parseInt(ym.split('-')[1]);
    const daysInMonth = new Date(year, month, 0).getDate();

    const daysData: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      daysData.push({ day: d, status: '-', in: '00:00', out: '00:00', ot: '0', late: '0' });
    }

    for (const rec of records) {
      const dateStr = this.parseDate(rec[6]);
      if (!dateStr || !dateStr.startsWith(ym)) continue;

      const day = parseInt(dateStr.split('-')[2]);
      const status = rec[0]?.trim();
      // Check for late - use calculated_late (policy-based) at index 14
      const lateValue = rec[14]; // calculated_late column (policy-based)
      const isLate = lateValue && lateValue.trim() !== '' && lateValue !== '00:00' && lateValue !== '0:00';

      // Determine status: Present -> 'P', Absent -> 'A', otherwise '-' (no data)
      let dayStatus = '-';
      if (status === 'Present') dayStatus = 'P';
      else if (status === 'Absent') dayStatus = 'A';

      daysData[day - 1] = {
        day,
        status: dayStatus,
        in: rec[10] || '00:00',
        out: rec[11] || '00:00',
        ot: rec[17] || '0',
        late: isLate ? '1' : '0',
      };
    }

    return daysData;
  }

  private calculateMonthlyTotals(daysData: any[]): { present: number; absent: number; late: number } {
    let present = 0, absent = 0, late = 0;
    for (const dd of daysData) {
      if (dd.status === 'P') {
        present++;
        // Only count late if present and has late flag
        if (dd.late && dd.late !== '' && dd.late !== '0' && dd.late !== '00:00') {
          late++;
        }
      }
      if (dd.status === 'A') absent++;
    }
    return { present, absent, late };
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;
    
    const trimmed = dateStr.trim();
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/,
    ];

    for (const format of formats) {
      if (format.test(trimmed)) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      }
    }
    return null;
  }

  /**
   * Recalculate calculated_late for all logs records of an employee
   * This updates the database with new late values based on CURRENT shift_policy_rule
   * Call this when shift_policy_rule changes in employee_policy_tagging
   */
  async recalculateAllLateForEmployee(empCode: string): Promise<{ 
    success: boolean; 
    message: string; 
    updated: number;
    details: Array<{ date: string; oldLate: string; newLate: string; clockIn: string }>;
  }> {
    try {
      // 1. Get current policy for this employee
      const [policyRows] = await this.db.execute(
        `SELECT shift_policy_rule, late_deduction_policy_rule, absent_deduction_policy_rule 
         FROM employee_policy_tagging 
         WHERE \`No.\` = ? OR \`AC-No.\` = ? OR \`Emp No.\` = ?
         ORDER BY id DESC LIMIT 1`,
        [empCode, empCode, empCode]
      );
      
      if ((policyRows as any[]).length === 0) {
        return {
          success: false,
          message: `No policy found for employee ${empCode}`,
          updated: 0,
          details: []
        };
      }
      
      const policy = (policyRows as any[])[0];
      const shiftPolicyRule = policy.shift_policy_rule || 'General shift (10 AM - 6 PM)';
      
      // 2. Get shift details
      const shift = await this.getShiftFromPolicyRule(shiftPolicyRule);
      if (!shift) {
        return {
          success: false,
          message: `No shift found for policy: ${shiftPolicyRule}`,
          updated: 0,
          details: []
        };
      }
      
      // 3. Get all logs records for this employee with clock-in
      const [logsRows] = await this.db.execute(
        `SELECT id, \`Date\`, \`Clock In\`, calculated_late, \`No.\`, \`AC-No.\`, \`Emp No.\`, \`Name\`
         FROM logs 
         WHERE (\`No.\` = ? OR \`AC-No.\` = ? OR \`Emp No.\` = ? OR emp_id = ?)
           AND \`Clock In\` IS NOT NULL 
           AND \`Clock In\` != ''
         ORDER BY \`Date\``,
        [empCode, empCode, empCode, empCode]
      );
      
      const logs = logsRows as any[];
      let updatedCount = 0;
      const details: Array<{ date: string; oldLate: string; newLate: string; clockIn: string }> = [];
      
      // 4. Calculate threshold (shift start + grace)
      const [shiftHour, shiftMin] = shift.start_time.split(':').map(Number);
      const thresholdMinutes = shiftHour * 60 + shiftMin + shift.grace_period_minutes;
      
      // 5. For each record, recalculate late
      for (const log of logs) {
        const clockIn = log['Clock In'];
        const oldLate = log.calculated_late || '';
        
        if (!clockIn) continue;
        
        const clockTime = this.parseClockTimeString(clockIn.toString());
        if (!clockTime) continue;
        
        const clockMinutes = clockTime.hour * 60 + clockTime.minute;
        
        // Calculate late
        const lateMinutes = Math.max(0, clockMinutes - thresholdMinutes);
        
        let newLate = '';
        if (lateMinutes > 0) {
          const hours = Math.floor(lateMinutes / 60);
          const mins = lateMinutes % 60;
          newLate = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }
        
        // Only update if changed
        if (newLate !== oldLate) {
          await this.db.execute(
            `UPDATE logs 
             SET calculated_late = ?, 
                 late_minutes = ?, 
                 calculated_late_minutes = ?,
                 shift_policy_rule = ?,
                 shift_code = ?,
                 shift_start_time = ?,
                 shift_grace_minutes = ?
             WHERE id = ?`,
            [
              newLate,
              lateMinutes,
              lateMinutes,
              shiftPolicyRule,
              shift.shift_code,
              shift.start_time,
              shift.grace_period_minutes,
              log.id
            ]
          );
          
          updatedCount++;
          details.push({
            date: log['Date'],
            oldLate: oldLate || '-',
            newLate: newLate || '-',
            clockIn: clockIn
          });
        }
      }
      
      console.log(`[Recalculate Late] Employee ${empCode}: Updated ${updatedCount} records based on ${shiftPolicyRule}`);
      
      return {
        success: true,
        message: `Updated ${updatedCount} records for employee ${empCode} using ${shiftPolicyRule}`,
        updated: updatedCount,
        details
      };
      
    } catch (error: any) {
      console.error('Error recalculating late:', error.message);
      throw new Error('Failed to recalculate late');
    }
  }

  /**
   * Clear all attendance data from logs and real_time_logs tables
   * This is used when user wants to reset and upload new CSV data
   */
  async clearAllData(): Promise<{ success: boolean; message: string; deleted: { logs: number; realTimeLogs: number } }> {
    try {
      // Delete from logs table (CSV imported data with calculated fields)
      const [logsResult] = await this.db.execute('DELETE FROM logs');
      const logsDeleted = (logsResult as any).affectedRows || 0;

      // Delete from real_time_logs table (punch machine real-time data)
      const [rtlResult] = await this.db.execute('DELETE FROM real_time_logs');
      const rtlDeleted = (rtlResult as any).affectedRows || 0;

      console.log(`[Clear Data] Deleted: ${logsDeleted} logs, ${rtlDeleted} real-time logs`);

      return {
        success: true,
        message: `Successfully cleared all attendance data`,
        deleted: {
          logs: logsDeleted,
          realTimeLogs: rtlDeleted,
        },
      };
    } catch (error: any) {
      console.error('Error clearing data:', error.message);
      throw new Error('Failed to clear attendance data');
    }
  }

  /**
   * Sync shift_policy_rule from employee_policy_tagging to logs table
   * This updates all logs records to match the current policy
   */
  async syncPolicyToLogs(empCode?: string): Promise<{ success: boolean; message: string; updated: number }> {
    try {
      let updatedCount = 0;

      if (empCode) {
        // Sync specific employee
        const [policyRows] = await this.db.execute(
          `SELECT \`AC-No.\`, \`No.\`, \`Emp No.\`, shift_policy_rule 
           FROM employee_policy_tagging 
           WHERE \`No.\` = ? OR \`AC-No.\` = ? OR \`Emp No.\` = ?
           ORDER BY id DESC LIMIT 1`,
          [empCode, empCode, empCode]
        );
        const policies = policyRows as any[];

        if (policies.length > 0 && policies[0].shift_policy_rule) {
          const policy = policies[0];
          const [updateResult] = await this.db.execute(
            `UPDATE logs 
             SET shift_policy_rule = ?
             WHERE (\`AC-No.\` = ? OR \`No.\` = ? OR \`Emp No.\` = ?)`,
            [policy.shift_policy_rule, policy['AC-No.'], policy['No.'], policy['Emp No.']]
          );
          updatedCount = (updateResult as any).affectedRows || 0;
        }

        return {
          success: true,
          message: `Synced policy for employee ${empCode}`,
          updated: updatedCount,
        };
      } else {
        // Sync all employees - get all policies and update logs
        const [allPolicies] = await this.db.execute(
          `SELECT \`AC-No.\`, \`No.\`, \`Emp No.\`, shift_policy_rule 
           FROM employee_policy_tagging 
           WHERE shift_policy_rule IS NOT NULL AND shift_policy_rule != ''`
        );
        const policies = allPolicies as any[];

        for (const policy of policies) {
          const [updateResult] = await this.db.execute(
            `UPDATE logs 
             SET shift_policy_rule = ?
             WHERE (\`AC-No.\` = ? OR \`No.\` = ? OR \`Emp No.\` = ?)
               AND (shift_policy_rule IS NULL OR shift_policy_rule != ?)`,
            [policy.shift_policy_rule, policy['AC-No.'], policy['No.'], policy['Emp No.'], policy.shift_policy_rule]
          );
          updatedCount += (updateResult as any).affectedRows || 0;
        }

        return {
          success: true,
          message: `Synced policies for ${policies.length} employees`,
          updated: updatedCount,
        };
      }
    } catch (error: any) {
      console.error('Error syncing policy to logs:', error.message);
      throw new Error('Failed to sync policy to logs');
    }
  }

  /**
   * Process uploaded CSV file and import attendance data
   * This is used when the attendance machine is offline
   * Expected columns: Status, Emp No., AC-No., No., Name, Auto-Assign, Date, Timetable, On duty, Off duty, Clock In, Clock Out, Normal, Real time, Late, Early, Absent, OT Time, Work Time, Exception, Must C/In, Must C/Out, Department, NDays, WeekEnd, Holiday, ATT_Time, NDays_OT, WeekEnd_OT, Holiday_OT
   */
  async processCsvFile(filePath: string): Promise<{ 
    recordsProcessed: number; 
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  }> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      let headers: string[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser({ 
          mapHeaders: ({ header }) => {
            const trimmedHeader = header.trim();
            headers.push(trimmedHeader);
            return trimmedHeader;
          }
        }))
        .on('data', (data) => {
          records.push(data);
        })
        .on('end', async () => {
          try {
            // Clean up temp file
            fs.unlinkSync(filePath);
            
            // Validate required columns exist (Status is NOT required - derived from Clock In)
            // Support multiple variations of column names
            const requiredColumnMappings = [
              { names: ['Emp No.', 'Emp No', 'Emp_No.', 'Emp_No', 'EMP NO.', 'EMPNO'], required: true },
              { names: ['AC-No.', 'AC-No', 'AC_No.', 'AC_No', 'AC-NO.', 'ACNO', 'AC No.'], required: true },
              { names: ['No.', 'No', 'NO.', 'NO', 'Num'], required: true },
              { names: ['Name', 'NAME', 'name'], required: true },
              { names: ['Date', 'date', 'DATE'], required: true },
              { names: ['Clock In', 'ClockIn', 'CLOCK IN', 'Clock_In', 'In'], required: true },
              { names: ['Clock Out', 'ClockOut', 'CLOCK OUT', 'Clock_Out', 'Out'], required: true }
            ];
            
            const missingColumns: string[] = [];
            for (const mapping of requiredColumnMappings) {
              const hasColumn = mapping.names.some(name => headers.includes(name));
              if (!hasColumn && mapping.required) {
                missingColumns.push(mapping.names[0]); // Use first name as representative
              }
            }
            
            if (missingColumns.length > 0) {
              throw new Error(`Missing required columns: ${missingColumns.join(', ')}. Found columns: ${headers.join(', ')}`);
            }
            
            // Check if Status column exists (optional)
            const hasStatusColumn = headers.includes('Status');
            console.log('[CSV Import] Status column present:', hasStatusColumn);
            
            console.log('[CSV Import] Valid columns found:', headers);
            console.log('[CSV Import] Total records to process:', records.length);
            
            const result = await this.importCsvRecords(records, headers);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Process uploaded file (CSV or Excel) and import attendance data
   * Converts Excel to CSV format if needed
   */
  async processUploadFile(filePath: string, originalName: string): Promise<{
    recordsProcessed: number;
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  }> {
    const fileExt = originalName.toLowerCase();
    
    // If it's an Excel file, convert to CSV first
    if (fileExt.endsWith('.xls') || fileExt.endsWith('.xlsx')) {
      console.log('[File Upload] Converting Excel to CSV:', originalName);
      const csvPath = await this.convertExcelToCsv(filePath);
      // Process the converted CSV file
      const result = await this.processCsvFile(csvPath);
      // Clean up original Excel file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      return result;
    }
    
    // If it's already CSV, process directly
    return this.processCsvFile(filePath);
  }

  /**
   * Convert Excel file to CSV format
   */
  private async convertExcelToCsv(filePath: string): Promise<string> {
    try {
      // Dynamic import xlsx to avoid issues if not installed
      const xlsx = await import('xlsx');
      
      // Read Excel file
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }
      
      // Convert JSON to CSV format
      const csvPath = filePath + '.csv';
      const headers = jsonData[0] as string[];
      
      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const csvRow = headers.map((header, index) => {
          const value = row[index] || '';
          // Escape values that contain commas or quotes
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return '"' + stringValue.replace(/"/g, '""') + '"';
          }
          return stringValue;
        });
        csvContent += csvRow.join(',') + '\n';
      }
      
      // Write CSV file
      fs.writeFileSync(csvPath, csvContent);
      
      console.log('[File Upload] Excel converted to CSV:', csvPath, 'Rows:', jsonData.length - 1);
      return csvPath;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[File Upload] Excel conversion error:', message);
      throw new Error(`Failed to convert Excel file: ${message}`);
    }
  }

  /**
   * Import CSV records into logs and real_time_logs tables
   * Redesigned for high reliability and strict matching
   */
  private async importCsvRecords(records: any[], headers: string[]): Promise<{
    recordsProcessed: number;
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  }> {
    const startTime = Date.now();
    const summary = {
      total: records.length,
      success: 0,
      skipped: 0,
      reasons: { noDate: 0, invalidDate: 0, employeeNotFound: 0, dbError: 0 }
    };

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    if (records.length === 0) {
      return { recordsProcessed: 0, logsInserted: 0, punchesCreated: 0, dateRange: { from: '', to: '' } };
    }

    // 1. Initialize Column Mapper
    const mapper = new CsvColumnMapper(headers);
    console.log('[CSV Import] Headers Normalized. Ready to process', records.length, 'records.');

    // 2. Pre-populate csv_employees with unique employees from this CSV
    await this.syncCsvEmployeesFromRecords(records, mapper);

    // 3. Process in optimized batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const [idx, rawRecord] of batch.entries()) {
        const rowNum = i + idx + 1;
        let empCodeForLog = 'unknown';
        let dateFormattedForLog = 'unknown';

        try {
          // Extract and normalize values
          const row = {
            date: mapper.getValue(rawRecord, 'date'),
            empNo: mapper.getValue(rawRecord, 'empNo'),
            acNo: mapper.getValue(rawRecord, 'acNo'),
            no: mapper.getValue(rawRecord, 'no'),
            name: mapper.getValue(rawRecord, 'name'),
            department: mapper.getValue(rawRecord, 'department'),
            clockIn: mapper.getValue(rawRecord, 'clockIn'),
            clockOut: mapper.getValue(rawRecord, 'clockOut'),
            status: mapper.getValue(rawRecord, 'status'),
            absent: mapper.getValue(rawRecord, 'absent')
          };

          // A. Date Validation
          if (!row.date) {
            summary.skipped++; summary.reasons.noDate++; continue;
          }
          const parsedDate = this.parseCsvDate(row.date);
          if (!parsedDate) {
            summary.skipped++; summary.reasons.invalidDate++; continue;
          }
          
          // Track date range
          if (!minDate || parsedDate < minDate) minDate = parsedDate;
          if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
          dateFormattedForLog = parsedDate.toISOString().split('T')[0];

          // B. STRICT Employee Resolution (No guessing)
          const employee = await this.resolveEmployeeStrict(row);
          if (!employee) {
            if (summary.reasons.employeeNotFound < 5) {
              console.warn(`[CSV Skip] Row ${rowNum}: Employee match failed for AC-No.=${row.acNo}`);
            }
            summary.skipped++; summary.reasons.employeeNotFound++; continue;
          }
          
          // Extract all 4 identity columns from employee record
          const empNo = employee['Emp No.'] || row.empNo || '';
          const acNo = employee['AC-No.'] || row.acNo || '';
          const no = employee['No.'] || row.no || '';
          const name = employee['Name'] || row.name || '';
          const department = employee['Department'] || row.department || '';
          empCodeForLog = acNo;

          // C. Calculate Status and Late
          const isAbsentFlag = row.absent === 'True' || row.absent === 'true' || row.absent === '1';
          let status = mapper.has('status') ? (row.status || 'Present') : (row.clockIn ? 'Present' : 'Absent');
          const finalStatus = isAbsentFlag ? 'Absent' : status;

          const calculatedLate = await this.calculateLateForCsvImport(acNo, dateFormattedForLog, row.clockIn, '');
          
          let lateMinutes = 0;
          let actualLate = 0;
          if (calculatedLate && calculatedLate !== '00:00') {
            const timeParts = calculatedLate.split(':');
            if (timeParts.length === 2) {
              lateMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
              actualLate = parseFloat((lateMinutes / 60).toFixed(2));
            }
          }
          if (!isFinite(actualLate)) actualLate = 0;

          // D. Get Policy and Salary
          const [policyRows] = await this.db.execute(
            `SELECT late_deduction_policy_rule, absent_deduction_policy_rule, shift_policy_rule
             FROM employee_policy_tagging WHERE \`AC-No.\` = ? LIMIT 1`,
            [acNo]
          );
          const policy = (policyRows as any[])[0] || {};

          const [salaryRows] = await this.db.execute(
            `SELECT gross_salary, basic_salary FROM employee_salary_information WHERE \`AC-No.\` = ? LIMIT 1`,
            [acNo]
          );
          const salaryInfo = (salaryRows as any[])[0] || {};
          const grossSalary = parseFloat(salaryInfo.gross_salary) || 0;
          const basicSalary = parseFloat(salaryInfo.basic_salary) || 0;
          const policyType = grossSalary > 0 ? 'gross' : 'not_applicable';

          // E. Get Shift Info
          let shiftCode = '', shiftStartTime = null, shiftGraceMinutes = 15;
          if (policy.shift_policy_rule) {
            const shift = await this.getShiftFromPolicyRule(policy.shift_policy_rule);
            if (shift) {
              shiftCode = shift.shift_code;
              shiftStartTime = shift.start_time;
              shiftGraceMinutes = shift.grace_period_minutes;
            }
          }

          // F. Atomic UPSERT into Logs (all 4 identity columns stored)
          await this.db.execute(
            `INSERT INTO logs (
              \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, emp_id, \`Date\`, \`Clock In\`, \`Clock Out\`,
              \`Late\`, calculated_late, \`Status\`, gross_salary, basic_salary, policy_type,
              shift_code, shift_policy_rule, shift_start_time, shift_grace_minutes,
              late_minutes, calculated_late_minutes, actual_late,
              late_deduction_policy, absent_deduction_policy,
              day, month, year, attendance_date, \`Auto-Assign\`, \`Timetable\`, \`On duty\`, \`Off duty\`,
              \`Normal\`, \`Real time\`, \`Early\`, \`Absent\`, \`OT Time\`, \`Work Time\`, \`Exception\`,
              \`Must C/In\`, \`Must C/Out\`, \`Department\`, \`NDays\`, \`WeekEnd\`, \`Holiday\`, \`ATT_Time\`,
              \`NDays_OT\`, \`WeekEnd_OT\`, \`Holiday_OT\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              \`Clock In\` = VALUES(\`Clock In\`), \`Clock Out\` = VALUES(\`Clock Out\`),
              calculated_late = VALUES(calculated_late), \`Status\` = VALUES(\`Status\`),
              actual_late = VALUES(actual_late)`,
            [
              empNo, acNo, no, name, acNo, row.date, row.clockIn, row.clockOut,
              rawRecord['Late'] || '', calculatedLate, finalStatus, grossSalary, basicSalary, policyType,
              shiftCode, policy.shift_policy_rule || 'General shift (10 AM - 6 PM)', shiftStartTime, shiftGraceMinutes,
              lateMinutes, lateMinutes, actualLate,
              policy.late_deduction_policy_rule || '5_late_1_absent', policy.absent_deduction_policy_rule || 'N/A',
              parsedDate.getDate(), parsedDate.getMonth() + 1, parsedDate.getFullYear(), dateFormattedForLog,
              rawRecord['Auto-Assign'] || '', rawRecord['Timetable'] || '', rawRecord['On duty'] || '', rawRecord['Off duty'] || '',
              rawRecord['Normal'] || '', rawRecord['Real time'] || '', rawRecord['Early'] || '', rawRecord['Absent'] || '',
              rawRecord['OT Time'] || '', rawRecord['Work Time'] || '', rawRecord['Exception'] || '',
              rawRecord['Must C/In'] || '', rawRecord['Must C/Out'] || '', department,
              rawRecord['NDays'] || '', rawRecord['WeekEnd'] || '', rawRecord['Holiday'] || '', rawRecord['ATT_Time'] || '',
              rawRecord['NDays_OT'] || '', rawRecord['WeekEnd_OT'] || '', rawRecord['Holiday_OT'] || ''
            ]
          );

          // G. Sync back to Master Employees (all 4 identity columns stored)
          await this.db.execute(
            `UPDATE employees 
             SET \`Emp No.\` = ?, \`No.\` = ?, \`Name\` = ?, department = ?, updated_at = NOW() 
             WHERE \`AC-No.\` = ?`,
            [empNo, no, name, department, acNo]
          );

          summary.success++;

        } catch (err: any) {
          const errorCode = err.code || 'UNKNOWN';
          console.error(`[CSV Error] Row ${rowNum} (${empCodeForLog}): [${errorCode}] ${err.message}`);
          summary.skipped++; summary.reasons.dbError++;
        }
      }

      if (i > 0 && i % 500 === 0) {
        console.log(`[CSV Import] Progress: ${i}/${records.length} records processed`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CSV Import] COMPLETED. Success: ${summary.success}, Skipped: ${summary.skipped} (${duration}s)`);
    
    return {
      recordsProcessed: records.length,
      logsInserted: summary.success,
      punchesCreated: 0,
      dateRange: {
        from: minDate ? minDate.toISOString().split('T')[0] : '',
        to: maxDate ? maxDate.toISOString().split('T')[0] : ''
      }
    };
  }

  /**
   * Parse CSV date format - supports multiple formats:
   * - M/D/YYYY or MM/DD/YYYY (US format)
   * - DD/MM/YYYY (International/Bangladesh format)
   * - YYYY-MM-DD (ISO format)
   * - DD-MM-YYYY (Dash format)
   */
  private parseCsvDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    // Try various date formats

    // 1. M/D/YYYY or MM/DD/YYYY (US format - original)
    let parts = trimmed.split('/');
    if (parts.length === 3) {
      const firstNum = parseInt(parts[0], 10);
      const secondNum = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      // Validate year first
      if (year < 2000 || year > 2100) {
        return null;
      }

      // Try M/D/YYYY (US format: month/day/year)
      // If first number > 12, it's likely DD/MM/YYYY
      if (firstNum <= 12) {
        const month = firstNum - 1; // 0-indexed
        const day = secondNum;
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime()) && date.getMonth() === month) {
            return date;
          }
        }
      }

      // Try DD/MM/YYYY (International format: day/month/year)
      // If second number > 12, first must be day
      if (secondNum <= 12) {
        const day = firstNum;
        const month = secondNum - 1;
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime()) && date.getMonth() === month && date.getDate() === day) {
            return date;
          }
        }
      }
    }

    // 2. DD-MM-YYYY or YYYY-MM-DD (dash format)
    parts = trimmed.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD (ISO format)
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year > 2000) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
      // DD-MM-YYYY
      else {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year > 2000) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }

    // 3. Fallback to standard JS parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  }

  /**
   * Combine date and time strings into MySQL datetime
   */
  private combineDateAndTime(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null;
    
    // Parse time (HH:MM or HH:MM:SS)
    const timeParts = timeStr.split(':');
    if (timeParts.length < 2) return null;
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  /**
   * Get attendance summary for salary sheet
   * NOW USES: logs table with calculated fields
   * This provides calculated_late, actual_absent, late_deduction_policy, etc.
   * Accepts date range to support cross-month CSV imports (e.g., Feb 15 - March 15)
   */
  async getSalaryAttendance(fromDate: string, toDate: string): Promise<{
    empNo: string;
    empName: string;
    daysInMonth: number;
    payDays: number;
    presentDays: number;
    lateDays: number;
    lateDeductionDays: number;
    lateDeductionAmount: number;
    absentDays: number;
    actualAbsent: number;
    fridayHolidays: number;
    weekends: number;
    grossSalary: number;
    basicSalary: number;
    lateDeductionPolicy: string;
    absentDeductionPolicy: string;
    absentDeductionAmount: number;
  }[]> {
    const startDate = this.parseDateForSalary(fromDate);
    const endDate = this.parseDateForSalary(toDate);
    if (!startDate || !endDate) {
      throw new Error(`Invalid salary sheet date range: ${fromDate} to ${toDate}`);
    }
    
    // Calculate actual number of days in the requested range
    const daysInMonth = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysInMonth <= 0) {
      throw new Error(`Invalid salary sheet date range: ${fromDate} to ${toDate}`);
    }

    // Debug: Check available date range in logs table
    const [dateRangeRows] = await this.db.execute(`
      SELECT 
        MIN(COALESCE(attendance_date, STR_TO_DATE(\`Date\`, '%m/%d/%Y'))) as minDate,
        MAX(COALESCE(attendance_date, STR_TO_DATE(\`Date\`, '%m/%d/%Y'))) as maxDate,
        COUNT(*) as totalRecords
      FROM logs
    `);
    const dateRange = (dateRangeRows as any[])[0];
    console.log(`[SalarySheet] Logs table date range: ${dateRange.minDate} to ${dateRange.maxDate}, total: ${dateRange.totalRecords} records`);
    console.log(`[SalarySheet] Requested date range: ${fromDate} to ${toDate}`);

    // Get data from logs table with calculated fields
    const [logsRows] = await this.db.execute(
      `SELECT
        l.\`AC-No.\` as acNo,
        l.\`No.\` as empNo,
        l.\`Name\` as empName,
        COALESCE(l.attendance_date, STR_TO_DATE(l.\`Date\`, '%m/%d/%Y')) as dateStr,
        COALESCE(l.calculated_late, l.\`Late\`, '') as late,
        COALESCE(l.late_minutes, 0) as lateMinutes,
        l.actual_absent,
        l.late_count,
        l.late_deduction_days,
        l.absent_deduction_amount,
        l.late_deduction_policy,
        l.absent_deduction_policy,
        l.gross_salary,
        l.\`Clock In\` as clockIn
      FROM logs l
      ORDER BY l.\`AC-No.\`, COALESCE(l.attendance_date, STR_TO_DATE(l.\`Date\`, '%m/%d/%Y'))`
    );

    const records: any[] = logsRows as any[];
    console.log(`[SalarySheet] Using ${records.length} records from logs table (all data, no date filter)`);
    
    // Group by employee
    const empMap = new Map<string, {
      empNo: string;
      empName: string;
      grossSalary: number;
      lateDeductionPolicy: string;
      absentDeductionPolicy: string;
      records: any[];
    }>();
    
    // Debug: Track first few records
    let debugLogCount = 0;
    const maxDebugLogs = 10;
    
    for (const rec of records) {
      const key = rec.acNo || rec.empNo || rec.empName;
      if (!key) continue;
      
      const dateStr = rec.dateStr;
      if (!dateStr) continue;

      const logDate = this.parseDateForSalary(dateStr);
      if (!logDate) continue;

      // Debug log first few records
      const hasClockIn = rec.clockIn && rec.clockIn.toString().trim() !== '';
      const derivedStatus = hasClockIn ? 'Present' : 'Absent';
      if (debugLogCount < maxDebugLogs) {
        console.log(`[SalarySheetInput] ${key} | ${dateStr} | status="${derivedStatus}" | late="${rec.late}" | policy="${rec.late_deduction_policy}"`);
        debugLogCount++;
      }
      
      if (!empMap.has(key)) {
        empMap.set(key, {
          empNo: rec.empNo || key,
          empName: rec.empName || '-',
          grossSalary: parseFloat(rec.gross_salary) || 0,
          lateDeductionPolicy: rec.late_deduction_policy || 'N/A',
          absentDeductionPolicy: rec.absent_deduction_policy || 'N/A',
          records: []
        });
      }
      empMap.get(key)!.records.push(rec);
    }
    
    // Calculate metrics for each employee with policy-based deductions
    const results: {
      empNo: string;
      empName: string;
      daysInMonth: number;
      payDays: number;
      presentDays: number;
      lateDays: number;
      lateDeductionDays: number;
      lateDeductionAmount: number;
      absentDays: number;
      actualAbsent: number;
      fridayHolidays: number;
      weekends: number;
      grossSalary: number;
      basicSalary: number;
      lateDeductionPolicy: string;
      absentDeductionPolicy: string;
      absentDeductionAmount: number;
    }[] = [];
    
    for (const [key, emp] of empMap) {
      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;
      let fridayCount = 0;
      let weekendCount = 0;
      
      const uniqueDates = new Set<string>();
      let debugCount = 0;
      const maxDebug = 20;
      
      for (const rec of emp.records) {
        const dateStr = rec.dateStr;
        if (!dateStr || uniqueDates.has(dateStr)) continue;
        uniqueDates.add(dateStr);
        
        // Parse date to check day of week
        const date = this.parseDateForSalary(dateStr);
        let isFriday = false;
        if (date) {
          const dayOfWeek = date.getDay();
          isFriday = dayOfWeek === 5;
          
          if (dayOfWeek === 5) fridayCount++;
          if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
        }
        
        // Derive status from clock-in data (no status column in attendance table)
        const clockIn = rec.clockIn?.toString().trim();
        const hasClockIn = clockIn && clockIn !== '';
        const derivedStatus = hasClockIn ? 'Present' : 'Absent';
        const storedLate = rec.late?.toString().trim();
        
        if (hasClockIn) {
          presentDays++;
        } else {
          absentDays++;
        }
        
        // Count late days (excluding Friday) - only for present employees
        if (!isFriday && hasClockIn) {
          if (storedLate && storedLate.trim() !== '' && storedLate !== '00:00' && storedLate !== '0:00') {
            lateDays++;
          }
        }
        
        if (debugCount < maxDebug) {
          console.log(`[SalarySheetDebug] ${key} | ${dateStr} | clockIn=${clockIn} | isFriday=${isFriday} | storedLate=${storedLate} | presentDays=${presentDays} | lateDays=${lateDays} | absentDays=${absentDays}`);
          debugCount++;
        }
      }
      
      // Calculate late deduction based on policy (6 late = 1 absent)
      const lateDeductionPolicy = emp.lateDeductionPolicy || 'N/A';
      let lateDeductionDays = 0;
      let lateDeductionAmount = 0;
      
      if (lateDeductionPolicy === 'APPLICABLE' && lateDays > 0) {
        lateDeductionDays = Math.floor(lateDays / 6);
      }
      
      // Calculate actual absent (original + late deduction)
      const actualAbsent = absentDays + lateDeductionDays;
      
      // Calculate absent deduction amount based on policy
      const absentDeductionPolicy = emp.absentDeductionPolicy || 'N/A';
      let absentDeductionAmount = 0;
      
      if (actualAbsent > 0 && emp.grossSalary > 0) {
        if (absentDeductionPolicy === 'ON_GROSS') {
          const perDayGross = emp.grossSalary / daysInMonth;
          absentDeductionAmount = perDayGross * actualAbsent;
          lateDeductionAmount = perDayGross * lateDeductionDays;
        } else if (absentDeductionPolicy === 'ON_BASIC') {
          // Use 50% of gross as basic salary (standard calculation)
          const basicSalary = emp.grossSalary * 0.5;
          const perDayBasic = basicSalary / daysInMonth;
          absentDeductionAmount = perDayBasic * actualAbsent;
          lateDeductionAmount = perDayBasic * lateDeductionDays;
        }
      }
      
      console.log(`[SalarySheetSummary] ${key}: Present=${presentDays}, Late=${lateDays}, LateDeduction=${lateDeductionDays}, Absent=${absentDays}, ActualAbsent=${actualAbsent}, Policy=${lateDeductionPolicy}`);
      
      // Calculate pay days (present days)
      const payDays = presentDays;
      
      results.push({
        empNo: emp.empNo || key,
        empName: emp.empName || '-',
        daysInMonth,
        payDays,
        presentDays,
        lateDays,
        lateDeductionDays,
        lateDeductionAmount: Math.round(lateDeductionAmount * 100) / 100,
        absentDays,
        actualAbsent,
        fridayHolidays: fridayCount,
        weekends: weekendCount,
        grossSalary: emp.grossSalary,
        basicSalary: emp.grossSalary * 0.5,
        lateDeductionPolicy,
        absentDeductionPolicy,
        absentDeductionAmount: Math.round(absentDeductionAmount * 100) / 100
      });
    }
    
    return results;
  }
  
  private parseDateForSalary(dateStr: string | Date): Date | null {
    if (!dateStr) return null;
    
    // If already a Date object, return it
    if (dateStr instanceof Date) return dateStr;
    
    // Convert to string if needed
    const str = dateStr.toString();
    
    // Handle M/D/YYYY or MM/DD/YYYY
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    // Handle YYYY-MM-DD
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    return null;
  }

  /**
   * Get all unique employees from CSV uploads (csv_employees table)
   * Used for policy tagging, salary sheet, and reports
   */
  async getCsvEmployees(search?: string): Promise<{
    id: number;
    empNo: string;
    acNo: string;
    no: string;
    name: string;
    department: string;
    isActive: boolean;
    policyTaggingId: number | null;
    createdAt: string;
    updatedAt: string;
  }[]> {
    try {
      let query = `
        SELECT 
          id,
          \`Emp No.\` as empNo,
          \`AC-No.\` as acNo,
          \`No.\` as no,
          \`Name\` as name,
          Department as department,
          is_active as isActive,
          policy_tagging_id as policyTaggingId,
          created_at as createdAt,
          updated_at as updatedAt
        FROM csv_employees 
        WHERE is_active = TRUE
      `;
      const params: any[] = [];

      // Search by Name only
      if (search && search.trim()) {
        query += ` AND \`Name\` LIKE ?`;
        params.push(`%${search.trim()}%`);
      }

      query += ` ORDER BY \`Name\` ASC`;

      const [rows] = await this.db.execute(query, params);
      return rows as any[];
    } catch (error) {
      console.error('[CSV Employees] Error fetching employees:', error);
      // If table doesn't exist, return empty array
      return [];
    }
  }

  /**
   * Get a single CSV employee by AC-No. (primary lookup key)
   */
  async getCsvEmployeeByACNo(acNo: string): Promise<{
    id: number;
    empNo: string;
    acNo: string;
    no: string;
    name: string;
    department: string;
    policyTaggingId: number | null;
  } | null> {
    try {
      const [rows] = await this.db.execute(
        `SELECT 
          id,
          \`Emp No.\` as empNo,
          \`AC-No.\` as acNo,
          \`No.\` as no,
          \`Name\` as name,
          Department as department,
          policy_tagging_id as policyTaggingId
        FROM csv_employees 
        WHERE \`AC-No.\` = ? AND is_active = TRUE
        LIMIT 1`,
        [acNo]
      );
      
      const employees = rows as any[];
      return employees.length > 0 ? employees[0] : null;
    } catch (error) {
      console.error(`[CSV Employees] Error fetching employee by AC-No. ${acNo}:`, error);
      return null;
    }
  }

  /**
   * Deprecated: Get a single CSV employee by emp_code
   * Use getCsvEmployeeByACNo instead
   */
  async getCsvEmployeeByCode(empCode: string): Promise<any | null> {
    return this.getCsvEmployeeByACNo(empCode);
  }

  /**
   * Update policy tagging for a CSV employee
   * Uses AC-No. as primary lookup key
   */
  async updateCsvEmployeePolicy(acNo: string, policyTaggingId: number | null): Promise<boolean> {
    try {
      await this.db.execute(
        `UPDATE csv_employees 
         SET policy_tagging_id = ?, updated_at = NOW()
         WHERE \`AC-No.\` = ?`,
        [policyTaggingId, acNo]
      );
      return true;
    } catch (error) {
      console.error(`[CSV Employees] Error updating policy for AC-No. ${acNo}:`, error);
      return false;
    }
  }

  /**
   * Lookup CSV employee by any identifier (Emp No., AC-No., No., or Name)
   * Returns the 4 CSV columns and other employee info
   */
  async lookupCsvEmployee(identifier: string): Promise<{
    empNo: string;
    acNo: string;
    no: string;
    name: string;
    department: string;
  } | null> {
    if (!identifier || identifier.trim() === '') {
      return null;
    }

    try {
      // Try to find by any of the 4 columns
      const [rows] = await this.db.execute(
        `SELECT \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, Department
         FROM csv_employees
         WHERE \`Emp No.\` = ? OR \`AC-No.\` = ? OR \`No.\` = ? OR \`Name\` LIKE ?
         LIMIT 1`,
        [identifier, identifier, identifier, `%${identifier}%`]
      );

      const csvEmps = rows as any[];
      if (csvEmps.length > 0) {
        return {
          empNo: csvEmps[0]['Emp No.'] || '',
          acNo: csvEmps[0]['AC-No.'] || '',
          no: csvEmps[0]['No.'] || '',
          name: csvEmps[0]['Name'] || '',
          department: csvEmps[0]['Department'] || ''
        };
      }
    } catch (error) {
      console.error(`[CSV Employees] Error looking up employee ${identifier}:`, error);
    }

    return null;
  }

  /**
   * Remove employee data (No., Name, Department) from employees table
   * Keeps the employee record but clears the CSV-imported fields
   */
  async removeEmployeeData(acNos: string[]): Promise<{ success: boolean; message: string; removed: number }> {
    try {
      let removed = 0;

      for (const acNo of acNos) {
        const [result] = await this.db.execute(
          `UPDATE employees
           SET \`No.\` = NULL,
               \`Name\` = NULL,
               department = NULL,
               updated_at = NOW()
           WHERE \`AC-No.\` = ?`,
          [acNo]
        );

        const affected = (result as any).affectedRows;
        if (affected > 0) {
          removed++;
        }
      }

      return {
        success: true,
        message: `Removed data for ${removed} employee(s)`,
        removed
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CSV Employees] Error removing employee data:', message);
      throw new Error(`Failed to remove employee data: ${message}`);
    }
  }

  /**
   * Clear all data from logs table before reupload
   */
  async clearLogs(): Promise<{ success: boolean; message: string; deleted: number }> {
    try {
      const [result] = await this.db.execute(`DELETE FROM logs`);
      const deleted = (result as any).affectedRows;

      return {
        success: true,
        message: `Cleared ${deleted} records from logs table`,
        deleted
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CSV Import] Error clearing logs:', message);
      throw new Error(`Failed to clear logs: ${message}`);
    }
  }
}
