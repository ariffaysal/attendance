import { api } from './api';
import { AttendanceStats, PaginationData, JobCardEmployee, MonthlySegment } from '@/types/attendance';

export interface SearchParams {
  search?: string;
  searchType?: 'general' | 'emp_no' | 'acc_no';
  fromDate?: string;
  toDate?: string;
  page?: number;
}

export interface RealtimeLog {
  id: number;
  device_user_id: string;
  emp_code: string | null;
  employee_name: string | null;
  punch_time: string;
  verify_type: string;
  status: 'CheckIn' | 'CheckOut';
  device_ip: string;
  processed?: number;
  created_at: string;
}

export const attendanceService = {
  // Sync real-time logs to attendance table
  async syncAttendance(fromDate?: string, toDate?: string): Promise<{ processed: number; message: string }> {
    const params: any = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const response = await api.post('/attendance/sync', {}, { params });
    return response.data;
  },

  // Get today's real-time punches
  async getTodayPunches(): Promise<RealtimeLog[]> {
    const response = await api.get('/attendance/today');
    return response.data;
  },

  // Get attendance records (from real-time data)
  async getRecords(params: SearchParams): Promise<PaginationData<any>> {
    const response = await api.get('/attendance/records', { params });
    return response.data;
  },

  // Get attendance statistics
  async getStats(params: SearchParams): Promise<AttendanceStats & { total: number; fromDate?: string; toDate?: string }> {
    const response = await api.get('/attendance/stats', { params });
    return response.data;
  },

  // Get job cards
  async getJobCards(params: SearchParams): Promise<JobCardEmployee[]> {
    const response = await api.get('/attendance/job-cards', { params });
    return response.data;
  },

  // Get monthly data
  async getMonthlyData(params: SearchParams): Promise<MonthlySegment[]> {
    const response = await api.get('/attendance/monthly', { params });
    return response.data;
  },

  // Sync device users to employees database
  async syncDeviceUsersToDb(): Promise<{
    success: boolean;
    message: string;
    totalDeviceUsers: number;
    newEmployees: number;
    updatedEmployees: number;
    failed: number;
    errors: string[];
  }> {
    const response = await api.post('/api/zkteco/sync-users-to-db');
    return response.data;
  },

  // Sync attendance from device to database (past 3 months + current month)
  async syncFromDevice(): Promise<{
    success: boolean;
    message: string;
    fetched: number;
    saved: number;
    dateRange: { from: string; to: string };
  }> {
    const response = await api.post('/api/zkteco/sync-attendance-from-device');
    return response.data;
  },

  // Get all users/employees
  async getAllUsers(): Promise<any[]> {
    const response = await api.get('/attendance/users');
    return response.data;
  },

  // Get attendance summary for salary sheet
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
    const response = await api.get('/attendance/salary-attendance', { params: { month } });
    return response.data;
  },

  // Clear all attendance data
  async clearData(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/attendance/clear-data');
    return response.data;
  },

  // Upload CSV file when attendance machine is offline
  async uploadCsv(file: File): Promise<{
    success: boolean;
    message: string;
    recordsProcessed: number;
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/attendance/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

};
