import { api } from './api';
import { AttendanceStats, PaginationData, JobCardEmployee, MonthlySegment } from '@/types/attendance';

export interface SearchParams {
  search?: string;
  searchType?: 'general' | 'acc_no' | 'name';
  fromDate?: string;
  toDate?: string;
  page?: number;
}

export const attendanceService = {
  // Get attendance records
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

  // Get attendance summary for salary sheet
  async getSalaryAttendance(fromDate: string, toDate: string): Promise<{
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
    const response = await api.get('/attendance/salary-attendance', { params: { fromDate, toDate } });
    return response.data;
  },

  // Clear all attendance data
  async clearData(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/attendance/clear-data');
    return response.data;
  },

  // Upload CSV file
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
