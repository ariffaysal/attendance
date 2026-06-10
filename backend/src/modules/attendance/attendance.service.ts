import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import {
  AttendanceStats,
  PaginationData,
  JobCardEmployee,
  JobCardDailyRecord,
  JobCardSummary,
  MonthlyEmployee,
} from './interfaces/attendance.interface';
import { SearchAttendanceDto } from './dto/search-attendance.dto';

// Real-time log entry interface
export interface RealtimeLogEntry {
  id: number;
  device_user_id: string;
  emp_code: string | null;
  employee_name: string | null;
  punch_time: Date;
  verify_type: string;
  status: 'CheckIn' | 'CheckOut';
  device_ip: string;
  created_at: Date;
}

// Attendance record for frontend display
export interface AttendanceDisplayRecord {
  status: 'Present' | 'Absent';
  empNo: string;
  acNo: string;
  no: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string;
  late: string;
  department: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(SQL_CONNECTION) private readonly db: mysql.Connection,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sync real_time_logs to attendance table
   * This aggregates punches into daily in_time/out_time records
   */
  async syncRealtimeToAttendance(fromDate?: string, toDate?: string): Promise<{ processed: number; message: string }> {
    const startDate = fromDate || new Date().toISOString().split('T')[0];
    const endDate = toDate || startDate;

    try {
      // Get all unprocessed real-time logs within date range
      const [logs] = await this.db.execute(
        `SELECT * FROM real_time_logs 
         WHERE DATE(punch_time) BETWEEN ? AND ? 
         AND (processed = 0 OR processed IS NULL)
         ORDER BY device_user_id, punch_time`,
        [startDate, endDate]
      );

      const records = logs as RealtimeLogEntry[];
      let processed = 0;

      // Group by employee and date
      const grouped = this.groupRealtimeLogsByEmployeeDate(records);

      for (const [key, punches] of Object.entries(grouped)) {
        const [empCode, dateStr] = key.split('_');
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        // Sort punches by time
        punches.sort((a, b) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());

        // First punch = CheckIn, Last punch = CheckOut
        const firstPunch = punches[0];
        const lastPunch = punches[punches.length - 1];

        const inTime = this.formatTime(firstPunch.punch_time);
        const outTime = punches.length > 1 ? this.formatTime(lastPunch.punch_time) : '';

        // Calculate late (assuming 9:00 AM is standard start time)
        const lateMinutes = this.calculateLateMinutes(firstPunch.punch_time, '09:00');
        const late = lateMinutes > 0 ? this.minutesToTimeString(lateMinutes) : '';

        // Insert or update attendance record
        await this.db.execute(
          `INSERT INTO attendance (emp_id, day, month, year, status, in_time, out_time, ot) 
           VALUES (?, ?, ?, ?, 'P', ?, ?, '')
           ON DUPLICATE KEY UPDATE 
           in_time = VALUES(in_time),
           out_time = VALUES(out_time),
           status = 'P'`,
          [empCode, day, month, year, inTime, outTime]
        );

        // Mark logs as processed
        const logIds = punches.map(p => p.id);
        if (logIds.length > 0) {
          await this.db.execute(
            `UPDATE real_time_logs SET processed = 1 WHERE id IN (${logIds.join(',')})`
          );
        }

        processed++;
      }

      return { processed, message: `Synced ${processed} attendance records` };
    } catch (error) {
      console.error('Sync error:', error);
      throw new Error(`Failed to sync attendance: ${error.message}`);
    }
  }

  /**
   * Get attendance records from real_time_logs (direct punch data)
   */
  async getRecords(dto: SearchAttendanceDto): Promise<PaginationData<AttendanceDisplayRecord>> {
    const allRecords = await this.loadFromRealtimeLogs(dto);
    const perPage = 20;
    const total = allRecords.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(Math.max(1, dto.page || 1), totalPages);
    const offset = (currentPage - 1) * perPage;

    return {
      records: allRecords.slice(offset, offset + perPage),
      total,
      currentPage,
      totalPages,
      perPage,
    };
  }

  /**
   * Get attendance statistics
   */
  async getStats(dto: SearchAttendanceDto): Promise<AttendanceStats & { total: number; fromDate?: string; toDate?: string }> {
    const records = await this.loadFromRealtimeLogs(dto);
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;

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
   */
  async getJobCards(dto: SearchAttendanceDto): Promise<JobCardEmployee[]> {
    // Use the attendance table for job cards (daily aggregated data)
    const records = await this.loadFromAttendanceTable(dto);
    const grouped = this.groupByEmployee(records);

    return Object.entries(grouped).map(([empId, group]) => {
      const summary = this.calculateJobCardSummary(group.records, dto.fromDate, dto.toDate);
      const dailyRecords = this.buildDailyRecords(group.records, dto.fromDate, dto.toDate);

      return {
        empId,
        name: group.name,
        empCode: group.empCode,
        idCard: group.idCard,
        dept: group.dept,
        summary,
        records: dailyRecords,
      };
    });
  }

  /**
   * Get monthly data
   */
  async getMonthlyData(dto: SearchAttendanceDto): Promise<{ year: number; month: string; ym: string; employees: MonthlyEmployee[] }[]> {
    const records = await this.loadFromAttendanceTable(dto);
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

      Object.entries(grouped).forEach(([empId, group]) => {
        const filtered = group.records.filter(r => {
          const recordDate = this.parseDate(r[6]); // date column
          return recordDate && recordDate.startsWith(segment.ym);
        });

        if (filtered.length > 0) {
          const daysData = this.buildMonthlyDaysData(filtered, segment.ym);
          const totals = this.calculateMonthlyTotals(daysData);

          employees.push({
            empId,
            name: group.name,
            no: group.empCode,
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
   * Get today's real-time punches
   */
  async getTodayPunches(): Promise<RealtimeLogEntry[]> {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await this.db.execute(
      `SELECT * FROM real_time_logs 
       WHERE DATE(punch_time) = ? 
       ORDER BY punch_time DESC`,
      [today]
    );
    return rows as RealtimeLogEntry[];
  }

  /**
   * Create a test punch for debugging
   */
  async createTestPunch(userId: string, name: string): Promise<{ success: boolean; message: string; id?: number }> {
    try {
      const [result] = await this.db.execute(
        `INSERT INTO real_time_logs 
         (device_user_id, emp_code, employee_name, punch_time, verify_type, status, device_ip) 
         VALUES (?, ?, ?, NOW(), 'Test', 'CheckIn', '127.0.0.1')`,
        [userId, userId, name]
      );
      const insertId = (result as any).insertId;
      console.log(`✅ Test punch created: ID ${insertId} for user ${userId}`);
      return { success: true, message: 'Test punch created', id: insertId };
    } catch (error) {
      console.error('❌ Failed to create test punch:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Normalize date from device to MySQL datetime format
   * Handles Unix timestamps (seconds or milliseconds) and string dates
   */
  private normalizeDate(dateInput: any): string {
    if (!dateInput) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Check if it's a Unix timestamp (all digits)
    if (typeof dateInput === 'number' || /^\d+$/.test(dateInput.toString().trim())) {
      const num = parseInt(dateInput.toString(), 10);
      // If it's after year 2000, it's a valid timestamp
      if (num > 946684800) { // Jan 1, 2000
        // Convert seconds to milliseconds if needed
        const ms = num > 1000000000000 ? num : num * 1000;
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

  /**
   * Save device logs to real_time_logs table
   */
  async saveDeviceLogs(deviceLogs: any[]): Promise<number> {
    let savedCount = 0;
    
    // Log all items with their timestamps to debug
    console.log(`[SaveDeviceLogs] Processing ${deviceLogs.length} logs from device:`);
    deviceLogs.forEach((log, index) => {
      const rawTime = log.record_time || log.attTime || log.timestamp || log.punchTime || 
                     log.punch_time || log.time || log.dateTime || log.datetime;
      const deviceUserId = log.user_id || log.userId || log.uid || log.deviceUserId || 
                           log.employeeId || log.employee_id || log.id || log.ID;
      console.log(`[SaveDeviceLogs] Log #${index}: user=${deviceUserId}, rawTime=${rawTime}, normalized=${this.normalizeDate(rawTime)}`);
    });
    
    for (const log of deviceLogs) {
      try {
        // Extract data from device log format - handle various field names
        const deviceUserId = log.user_id || log.userId || log.uid || log.deviceUserId || 
                           log.employeeId || log.employee_id || log.id || log.ID;
        
        const rawTime = log.record_time || log.attTime || log.timestamp || log.punchTime || 
                       log.punch_time || log.time || log.dateTime || log.datetime;
        
        // Normalize the date to proper MySQL format
        const attTime = this.normalizeDate(rawTime);
        
        if (!deviceUserId || !attTime) {
          console.log('[SaveDeviceLogs] Skipping - missing values:', { 
            user_id: log.user_id, 
            record_time: log.record_time,
            deviceUserId: deviceUserId, 
            attTime: attTime 
          });
          continue;
        }
        
        // Check if this log already exists (prevent duplicates)
        const [existing] = await this.db.execute(
          `SELECT id FROM real_time_logs 
           WHERE device_user_id = ? AND punch_time = ?`,
          [deviceUserId, attTime]
        );
        
        if (existing && (existing as any[]).length > 0) {
          console.log(`[SaveDeviceLogs] Skipping duplicate: ${deviceUserId} at ${attTime}`);
          continue; // Skip duplicate
        }
        
        // Try to find employee by device ID
        let empCode = null;
        let empName = 'Unknown';
        try {
          const [empRows] = await this.db.execute(
            `SELECT emp_code, full_name_english FROM employees WHERE emp_id = ? OR punch_card = ? LIMIT 1`,
            [deviceUserId, deviceUserId]
          );
          const emp = (empRows as any[])[0];
          if (emp) {
            empCode = emp.emp_code;
            empName = emp.full_name_english;
          }
        } catch (e) {
          // employees table might not exist
        }
        
        // Insert log
        await this.db.execute(
          `INSERT INTO real_time_logs 
           (device_user_id, emp_code, employee_name, punch_time, verify_type, status, device_ip) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceUserId,
            empCode,
            empName,
            attTime,
            log.verifyType || log.verify || 'Fingerprint',
            'CheckIn', // Default status
            '192.168.203.2'
          ]
        );
        
        savedCount++;
        console.log(`[SaveDeviceLogs] Saved: ${empName} (${deviceUserId}) at ${attTime}`);
      } catch (error) {
        console.error('[SaveDeviceLogs] Error saving log:', log, error.message);
      }
    }
    
    console.log(`✅ Saved ${savedCount} device logs to real_time_logs`);
    return savedCount;
  }

  // Private helper methods

  private groupRealtimeLogsByEmployeeDate(records: RealtimeLogEntry[]): Record<string, RealtimeLogEntry[]> {
    const grouped: Record<string, RealtimeLogEntry[]> = {};
    
    for (const record of records) {
      const empCode = record.emp_code || record.device_user_id;
      const date = new Date(record.punch_time).toISOString().split('T')[0];
      const key = `${empCode}_${date}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    }
    
    return grouped;
  }

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

  private async loadFromRealtimeLogs(dto: SearchAttendanceDto): Promise<AttendanceDisplayRecord[]> {
    const searchTerms = dto.search ? dto.search.split(',').map(s => s.trim()).filter(s => s) : [];
    
    let query = `
      SELECT 
        rtl.*,
        e.emp_code,
        e.full_name_english,
        e.department,
        COALESCE(e.full_name_english, rtl.employee_name) as display_name,
        COALESCE(e.emp_code, rtl.device_user_id) as display_emp_code
      FROM real_time_logs rtl
      LEFT JOIN employees e ON (e.emp_id = rtl.device_user_id OR e.punch_card = rtl.device_user_id)
      WHERE 1=1
    `;
    const params: any[] = [];

    if (searchTerms.length > 0) {
      query += ` AND (`;
      query += searchTerms.map(() => 
        `(e.full_name_english LIKE ? OR rtl.device_user_id = ? OR e.emp_code LIKE ?)`
      ).join(' OR ');
      query += `)`;
      
      for (const term of searchTerms) {
        params.push(`%${term}%`, term, `%${term}%`);
      }
    }

    if (dto.fromDate && dto.toDate) {
      query += ` AND DATE(rtl.punch_time) >= ? AND DATE(rtl.punch_time) <= ?`;
      params.push(dto.fromDate, dto.toDate);
    }

    query += ` ORDER BY rtl.punch_time DESC`;

    const [rows] = await this.db.execute(query, params);
    const logs = rows as any[];

    // Group by employee and date to create daily records
    const dailyMap: Record<string, any> = {};
    
    for (const log of logs) {
      if (!log) continue;
      const empCode = log.display_emp_code || log.device_user_id;
      
      // Parse date safely using the helper method
      const punchDate = this.parsePunchTime(log.punch_time);
      const date = punchDate.toISOString().split('T')[0];
      
      const key = `${empCode}_${date}`;
      
      if (!dailyMap[key]) {
        dailyMap[key] = {
          empNo: log.emp_code || '',
          acNo: log.device_user_id,
          no: log.display_emp_code || log.device_user_id,
          name: log.display_name || 'Unknown',
          date: date,
          punches: [],
          department: log.department || '',
        };
      }
      
      dailyMap[key].punches.push(log);
    }

    // Convert to display records
    return Object.values(dailyMap).map((day: any) => {
      day.punches.sort((a: any, b: any) => {
        const timeA = this.parsePunchTime(a.punch_time).getTime() || 0;
        const timeB = this.parsePunchTime(b.punch_time).getTime() || 0;
        return timeA - timeB;
      });
      
      const firstPunch = day.punches[0];
      const lastPunch = day.punches[day.punches.length - 1];
      
      const inTime = this.formatTime(firstPunch.punch_time);
      const outTime = day.punches.length > 1 ? this.formatTime(lastPunch.punch_time) : '';
      
      const lateMinutes = this.calculateLateMinutes(firstPunch.punch_time, '09:00');
      const late = lateMinutes > 0 ? this.minutesToTimeString(lateMinutes) : '';
      
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

  private async loadFromAttendanceTable(dto: SearchAttendanceDto): Promise<string[][]> {
    // First get data from attendance table (punch machine data)
    let attendanceQuery = `
      SELECT 
        'Present' as status,
        a.emp_id,
        '' as ac_no,
        a.emp_id as emp_no,
        COALESCE(e.full_name_english, a.emp_id) as name,
        '' as auto_assign,
        CONCAT(a.year, '-', LPAD(a.month, 2, '0'), '-', LPAD(a.day, 2, '0')) as date,
        '' as timetable,
        '09:00' as on_duty,
        '18:00' as off_duty,
        a.in_time as clock_in,
        a.out_time as clock_out,
        '' as normal,
        '' as real_time,
        CASE WHEN TIME(a.in_time) > '09:00' THEN 
          TIME_FORMAT(SEC_TO_TIME(TIME_TO_SEC(a.in_time) - TIME_TO_SEC('09:00')), '%H:%i')
        ELSE '' END as late,
        '' as early,
        '' as absent,
        a.ot as ot_time,
        '' as work_time,
        '' as exception,
        '' as must_cin,
        '' as must_cout,
        COALESCE(e.department, '') as department,
        '' as ndays,
        '' as weekend,
        '' as holiday,
        '' as att_time,
        '' as ndays_ot,
        '' as weekend_ot,
        '' as holiday_ot
      FROM attendance a
      LEFT JOIN employees e ON e.emp_code = a.emp_id
      WHERE 1=1
    `;
    const attendanceParams: any[] = [];

    if (dto.search) {
      attendanceQuery += ` AND (e.full_name_english LIKE ? OR a.emp_id LIKE ?)`;
      attendanceParams.push(`%${dto.search}%`, `%${dto.search}%`);
    }

    if (dto.fromDate && dto.toDate) {
      attendanceQuery += ` AND CONCAT(a.year, '-', LPAD(a.month, 2, '0'), '-', LPAD(a.day, 2, '0')) BETWEEN ? AND ?`;
      attendanceParams.push(dto.fromDate, dto.toDate);
    }

    // Get data from logs table (CSV imported data)
    let logsQuery = `
      SELECT 
        l.Status as status,
        l.\`Emp No.\` as emp_id,
        l.\`AC-No.\` as ac_no,
        l.\`No.\` as emp_no,
        l.\`Name\` as name,
        COALESCE(l.\`Auto-Assign\`, '') as auto_assign,
        l.\`Date\` as date,
        COALESCE(l.\`Timetable\`, '') as timetable,
        COALESCE(l.\`On duty\`, '09:00') as on_duty,
        COALESCE(l.\`Off duty\`, '18:00') as off_duty,
        l.\`Clock In\` as clock_in,
        l.\`Clock Out\` as clock_out,
        COALESCE(l.\`Normal\`, '') as normal,
        COALESCE(l.\`Real time\`, '') as real_time,
        COALESCE(l.\`Late\`, '') as late,
        COALESCE(l.\`Early\`, '') as early,
        COALESCE(l.\`Absent\`, '') as absent,
        COALESCE(l.\`OT Time\`, '') as ot_time,
        COALESCE(l.\`Work Time\`, '') as work_time,
        COALESCE(l.\`Exception\`, '') as exception,
        COALESCE(l.\`Must C/In\`, '') as must_cin,
        COALESCE(l.\`Must C/Out\`, '') as must_cout,
        COALESCE(l.\`Department\`, '') as department,
        COALESCE(l.\`NDays\`, '') as ndays,
        COALESCE(l.\`WeekEnd\`, '') as weekend,
        COALESCE(l.\`Holiday\`, '') as holiday,
        COALESCE(l.\`ATT_Time\`, '') as att_time,
        COALESCE(l.\`NDays_OT\`, '') as ndays_ot,
        COALESCE(l.\`WeekEnd_OT\`, '') as weekend_ot,
        COALESCE(l.\`Holiday_OT\`, '') as holiday_ot
      FROM logs l
      WHERE 1=1
    `;
    const logsParams: any[] = [];

    if (dto.search) {
      logsQuery += ` AND (l.\`Name\` LIKE ? OR l.\`No.\` LIKE ? OR l.\`Emp No.\` LIKE ?)`;
      logsParams.push(`%${dto.search}%`, `%${dto.search}%`, `%${dto.search}%`);
    }

    // Execute both queries and combine results
    const [attendanceRows] = await this.db.execute(attendanceQuery, attendanceParams);
    const [logsRows] = await this.db.execute(logsQuery, logsParams);

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
      row.status, row.emp_id, row.ac_no, row.emp_no, row.name, row.auto_assign,
      convertDates ? convertDate(row.date) : row.date,
      row.timetable, row.on_duty, row.off_duty, row.clock_in, row.clock_out,
      row.normal, row.real_time, row.late, row.early, row.absent, row.ot_time,
      row.work_time, row.exception, row.must_cin, row.must_cout, row.department,
      row.ndays, row.weekend, row.holiday, row.att_time, row.ndays_ot, row.weekend_ot, row.holiday_ot
    ];

    const attendanceRecords = (attendanceRows as any[]).map(row => formatRow(row, false));
    let logsRecords = (logsRows as any[]).map(row => formatRow(row, true));

    // Filter logs by date in JS if date range specified
    if (dto.fromDate && dto.toDate) {
      logsRecords = logsRecords.filter(rec => {
        const date = rec[6]; // date column
        return date >= dto.fromDate && date <= dto.toDate;
      });
    }

    // Combine and remove duplicates (based on emp_no + date)
    const seen = new Set<string>();
    const combined: string[][] = [];

    for (const record of [...attendanceRecords, ...logsRecords]) {
      const key = `${record[3]}_${record[6]}`; // emp_no + date
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(record);
      }
    }

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
  private groupByEmployee(records: string[][]): Record<string, { name: string; empCode: string; idCard: string; dept: string; records: string[][] }> {
    const groups: Record<string, any> = {};

    for (const rec of records) {
      const empId = rec[3]; // emp_no column
      if (!groups[empId]) {
        groups[empId] = {
          name: rec[4] || '-', // name column
          empCode: rec[3] || '-',
          idCard: rec[2] || '-',
          dept: rec[22] || '-',
          records: [],
        };
      }
      groups[empId].records.push(rec);
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

    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const isFriday = dayOfWeek === 5;

      if (dateIndex[dateKey]) {
        const rec = dateIndex[dateKey];
        const isPresent = rec[0] === 'Present';

        if (isFriday) {
          weekend++;
          if (isPresent) present++;
        } else {
          workingDays++;
          if (isPresent) {
            present++;
            if (rec[14] && rec[14] !== '00:00') late++;
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
      const isLate = rec[14] && rec[14] !== '00:00';

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
      if (dd.status === 'P') present++;
      if (dd.status === 'A') absent++;
      if (dd.late === '1') late++;
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
   * Get all users/employees from database
   */
  async getAllUsers(): Promise<any[]> {
    try {
      const [rows] = await this.db.execute(
        `SELECT id, emp_id, emp_code, full_name_english, full_name_bangla, 
                department, designation, status, created_at
         FROM employees 
         ORDER BY full_name_english ASC`
      );
      return rows as any[];
    } catch (error: any) {
      console.error('Error getting users:', error.message);
      throw new Error('Failed to get users from database');
    }
  }

  /**
   * Clear all attendance data from logs, real_time_logs, and attendance tables
   * This is used when user wants to reset and upload new CSV data
   */
  async clearAllData(): Promise<{ success: boolean; message: string; deleted: { logs: number; realTimeLogs: number; attendance: number } }> {
    try {
      // Delete from logs table (CSV imported data)
      const [logsResult] = await this.db.execute('DELETE FROM logs');
      const logsDeleted = (logsResult as any).affectedRows || 0;

      // Delete from real_time_logs table (punch machine real-time data)
      const [rtlResult] = await this.db.execute('DELETE FROM real_time_logs');
      const rtlDeleted = (rtlResult as any).affectedRows || 0;

      // Delete from attendance table (aggregated daily data)
      const [attResult] = await this.db.execute('DELETE FROM attendance');
      const attDeleted = (attResult as any).affectedRows || 0;

      console.log(`[Clear Data] Deleted: ${logsDeleted} logs, ${rtlDeleted} real-time logs, ${attDeleted} attendance records`);

      return {
        success: true,
        message: `Successfully cleared all attendance data`,
        deleted: {
          logs: logsDeleted,
          realTimeLogs: rtlDeleted,
          attendance: attDeleted,
        },
      };
    } catch (error: any) {
      console.error('Error clearing data:', error.message);
      throw new Error('Failed to clear attendance data');
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
        .pipe(csv({ 
          mapHeaders: ({ header }) => {
            headers.push(header);
            return header;
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
            const requiredColumns = ['Emp No.', 'AC-No.', 'No.', 'Name', 'Date', 'Clock In', 'Clock Out'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
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
    } catch (error) {
      console.error('[File Upload] Excel conversion error:', error.message);
      throw new Error(`Failed to convert Excel file: ${error.message}`);
    }
  }

  /**
   * Import CSV records into logs and real_time_logs tables
   * Uses exact column names from CSV header
   */
  private async importCsvRecords(records: any[], headers: string[]): Promise<{
    recordsProcessed: number;
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  }> {
    let logsInserted = 0;
    let punchesCreated = 0;
    let skippedRecords = 0;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    console.log('[CSV Import] Starting import of', records.length, 'records');

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Parse the date from CSV (format: M/D/YYYY or MM/DD/YYYY)
          const dateStr = record['Date'];
          if (!dateStr) {
            skippedRecords++;
            continue;
          }

          const parsedDate = this.parseCsvDate(dateStr);
          if (!parsedDate) {
            console.log('[CSV Import] Invalid date:', dateStr);
            skippedRecords++;
            continue;
          }

          // Track date range
          if (!minDate || parsedDate < minDate) minDate = parsedDate;
          if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;

          const dateFormatted = parsedDate.toISOString().split('T')[0];
          
          // Extract employee info using exact column names
          const empNo = record['Emp No.'] || '';
          const acNo = record['AC-No.'] || '';
          const empCode = record['No.'] || '';
          const name = record['Name'] || '';
          const department = record['Department'] || '';
          
          // Clock times
          const clockIn = record['Clock In'] || '';
          const clockOut = record['Clock Out'] || '';
          
          // Derive status from Clock In - if Clock In has value, Present; otherwise Absent
          // Only use Status column from CSV if it exists
          let status = 'Present';
          if (headers.includes('Status')) {
            status = record['Status'] || 'Present';
          } else {
            // Derive from Clock In presence
            status = clockIn && clockIn.trim() ? 'Present' : 'Absent';
          }
          
          // Also check the Absent column if present
          const isAbsentFlag = record['Absent'] === 'True' || record['Absent'] === 'true' || record['Absent'] === '1';
          
          // Skip if no meaningful data
          if (!empNo && !acNo && !empCode) {
            skippedRecords++;
            continue;
          }
          
          // Final status determination
          const finalStatus = isAbsentFlag ? 'Absent' : status;
          
          // 1. Insert into logs table (raw CSV data) - using all columns
          // Note: Status is derived (not from CSV) if CSV doesn't have Status column
          const statusValue = headers.includes('Status') ? (record['Status'] || finalStatus) : finalStatus;
          
          await this.db.execute(
            `INSERT INTO logs (
              \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, \`Auto-Assign\`, \`Date\`, \`Timetable\`,
              \`On duty\`, \`Off duty\`, \`Clock In\`, \`Clock Out\`, \`Normal\`, \`Real time\`,
              \`Late\`, \`Early\`, \`Absent\`, \`OT Time\`, \`Work Time\`, \`Exception\`,
              \`Must C/In\`, \`Must C/Out\`, \`Department\`, \`NDays\`, \`WeekEnd\`,
              \`Holiday\`, \`ATT_Time\`, \`NDays_OT\`, \`WeekEnd_OT\`, \`Holiday_OT\`, \`Status\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              \`Status\` = VALUES(\`Status\`),
              \`Clock In\` = VALUES(\`Clock In\`),
              \`Clock Out\` = VALUES(\`Clock Out\`),
              \`Late\` = VALUES(\`Late\`),
              \`Early\` = VALUES(\`Early\`),
              \`Work Time\` = VALUES(\`Work Time\`),
              \`OT Time\` = VALUES(\`OT Time\`)`,
            [
              empNo,
              acNo,
              empCode,
              name,
              record['Auto-Assign'] || '',
              dateStr,
              record['Timetable'] || '',
              record['On duty'] || '',
              record['Off duty'] || '',
              clockIn,
              clockOut,
              record['Normal'] || '',
              record['Real time'] || '',
              record['Late'] || '',
              record['Early'] || '',
              record['Absent'] || '',
              record['OT Time'] || '',
              record['Work Time'] || '',
              record['Exception'] || '',
              record['Must C/In'] || '',
              record['Must C/Out'] || '',
              department,
              record['NDays'] || '',
              record['WeekEnd'] || '',
              record['Holiday'] || '',
              record['ATT_Time'] || '',
              record['NDays_OT'] || '',
              record['WeekEnd_OT'] || '',
              record['Holiday_OT'] || '',
              statusValue
            ]
          );
          logsInserted++;

          // 2. Create real_time_logs entries for dashboard display
          const deviceUserId = acNo || empNo || empCode;
          
          // Convert Clock In to punch_time
          if (clockIn && clockIn.trim()) {
            const punchDateTime = this.combineDateAndTime(dateFormatted, clockIn);
            if (punchDateTime) {
              // Check for duplicate
              const [existing] = await this.db.execute(
                `SELECT id FROM real_time_logs 
                 WHERE device_user_id = ? AND punch_time = ?`,
                [deviceUserId, punchDateTime]
              );
              
              if (!(existing as any[]).length) {
                await this.db.execute(
                  `INSERT INTO real_time_logs 
                   (device_user_id, emp_code, employee_name, punch_time, verify_type, status, device_ip) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    deviceUserId,
                    empCode,
                    name,
                    punchDateTime,
                    'CSV Import',
                    'CheckIn',
                    'CSV_UPLOAD'
                  ]
                );
                punchesCreated++;
              }
            }
          }

          // Convert Clock Out to punch_time (if different from Clock In)
          if (clockOut && clockOut.trim() && clockOut !== clockIn) {
            const punchDateTime = this.combineDateAndTime(dateFormatted, clockOut);
            if (punchDateTime) {
              // Check for duplicate
              const [existing] = await this.db.execute(
                `SELECT id FROM real_time_logs 
                 WHERE device_user_id = ? AND punch_time = ?`,
                [deviceUserId, punchDateTime]
              );
              
              if (!(existing as any[]).length) {
                await this.db.execute(
                  `INSERT INTO real_time_logs 
                   (device_user_id, emp_code, employee_name, punch_time, verify_type, status, device_ip) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    deviceUserId,
                    empCode,
                    name,
                    punchDateTime,
                    'CSV Import',
                    'CheckOut',
                    'CSV_UPLOAD'
                  ]
                );
                punchesCreated++;
              }
            }
          }

        } catch (err) {
          console.error(`[CSV Import] Error processing record:`, record, err.message);
          skippedRecords++;
          // Continue with next record
        }
      }
      
      // Log progress every 100 records
      if (i > 0 && i % 500 === 0) {
        console.log(`[CSV Import] Progress: ${i}/${records.length} records processed`);
      }
    }

    console.log(`[CSV Import] Completed: ${logsInserted} logs, ${punchesCreated} punches, ${skippedRecords} skipped`);
    
    return {
      recordsProcessed: records.length,
      logsInserted,
      punchesCreated,
      dateRange: {
        from: minDate ? minDate.toISOString().split('T')[0] : '',
        to: maxDate ? maxDate.toISOString().split('T')[0] : ''
      }
    };
  }

  /**
   * Parse CSV date format (M/D/YYYY or MM/DD/YYYY)
   */
  private parseCsvDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Try M/D/YYYY format (1/1/2026)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Fallback to standard parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
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
   * Get attendance summary for salary sheet from CSV logs
   */
  async getSalaryAttendance(month: string): Promise<{
    empNo: string;
    empName: string;
    daysInMonth: number;
    payDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    fridayHolidays: number;
    weekends: number;
  }[]> {
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    // Get all logs and filter by date in JavaScript to handle different date formats
    const [rows] = await this.db.execute(
      `SELECT 
        \`Emp No.\` as empNo,
        \`Name\` as empName,
        \`Date\` as dateStr,
        \`Status\` as status,
        \`Late\` as late,
        \`Absent\` as absent
      FROM logs 
      ORDER BY \`Emp No.\`, \`Date\``
    );
    
    const logs = rows as any[];
    
    // Group by employee
    const empMap = new Map<string, {
      empNo: string;
      empName: string;
      records: any[];
    }>();
    
    for (const log of logs) {
      const key = log.empNo || log.empName;
      if (!key) continue;
      
      // Filter by month - handle different date formats
      const dateStr = log.dateStr;
      if (!dateStr) continue;
      
      const logDate = this.parseDateForSalary(dateStr);
      if (!logDate) continue;
      
      // Check if this record is in the requested month
      if (logDate.getFullYear() !== year || logDate.getMonth() + 1 !== monthNum) {
        continue;
      }
      
      if (!empMap.has(key)) {
        empMap.set(key, {
          empNo: log.empNo,
          empName: log.empName,
          records: []
        });
      }
      empMap.get(key)!.records.push(log);
    }
    
    // Calculate metrics for each employee
    const results: {
      empNo: string;
      empName: string;
      daysInMonth: number;
      payDays: number;
      presentDays: number;
      lateDays: number;
      absentDays: number;
      fridayHolidays: number;
      weekends: number;
    }[] = [];
    
    for (const [key, emp] of empMap) {
      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;
      let fridayCount = 0;
      let weekendCount = 0;
      
      const uniqueDates = new Set<string>();
      
      for (const rec of emp.records) {
        const dateStr = rec.dateStr;
        if (!dateStr || uniqueDates.has(dateStr)) continue;
        uniqueDates.add(dateStr);
        
        // Parse date to check day of week
        const date = this.parseDateForSalary(dateStr);
        if (date) {
          const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
          
          if (dayOfWeek === 5) fridayCount++;
          if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
        }
        
        // Count statuses
        const status = rec.status?.toString().trim();
        const late = rec.late?.toString().trim();
        const absent = rec.absent?.toString().trim();
        
        if (status === 'Present' || status === 'P') {
          presentDays++;
        }
        if (late && late !== '' && late !== '0' && late !== '00:00') {
          lateDays++;
        }
        if (status === 'Absent' || status === 'A' || absent === '1') {
          absentDays++;
        }
      }
      
      // Calculate pay days (present days, excluding weekends/holidays from deduction)
      const payDays = presentDays;
      
      results.push({
        empNo: emp.empNo || key,
        empName: emp.empName || '-',
        daysInMonth,
        payDays,
        presentDays,
        lateDays,
        absentDays,
        fridayHolidays: fridayCount,
        weekends: weekendCount
      });
    }
    
    return results;
  }
  
  private parseDateForSalary(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Handle M/D/YYYY or MM/DD/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    // Handle YYYY-MM-DD
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    return null;
  }
}
