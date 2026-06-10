import { api } from './api';

export interface Shift {
  id: number;
  shift_code: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_night_shift: boolean;
  max_consecutive_days: number;
  rest_hours_required: number;
  description?: string;
}

export interface ShiftAssignment {
  id?: number;
  emp_code: string;
  assignment_date: string;
  shift_id: number;
  is_off_day?: boolean;
  notes?: string;
  shift_code?: string;
  shift_name?: string;
  start_time?: string;
  end_time?: string;
  is_night_shift?: boolean;
}

export interface ShiftValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  prevShift?: {
    shiftCode: string;
    endTime: string;
    assignmentDate: string;
  };
  nextShift?: {
    shiftCode: string;
    startTime: string;
    assignmentDate: string;
  };
  restHours?: number;
  requiredRestHours?: number;
}

export interface RosterTemplate {
  id: number;
  templateName: string;
  templateCode: string;
  cycleDays: number;
  pattern: string[];
}

export interface RosterGenerationResult {
  success: boolean;
  totalAssignments: number;
  violationsFound: number;
  violationsResolved: number;
  errors: string[];
  assignmentsByEmployee: Map<string, number>;
}

export const shiftService = {
  // Shifts
  async getAllShifts(): Promise<Shift[]> {
    const response = await api.get('/hrm/shifts');
    return response.data.data || [];
  },

  async getShiftOptions(): Promise<Array<{label: string; value: string; shift_code: string; start_time: string; end_time: string; grace_period_minutes: number}>> {
    const response = await api.get('/hrm/shifts/options');
    return response.data.data || [];
  },

  async getShiftById(id: number): Promise<Shift | null> {
    const response = await api.get(`/hrm/shifts/${id}`);
    return response.data.data || null;
  },

  // Shift Assignments
  async assignShift(dto: {
    empCode: string;
    assignmentDate: string;
    shiftId: number;
    notes?: string;
    skipValidation?: boolean;
  }): Promise<{ success: boolean; id?: number; validation?: ShiftValidationResult; error?: string }> {
    const response = await api.post('/hrm/shifts/assign', dto);
    return response.data;
  },

  async bulkAssignShifts(dto: {
    empCodes: string[];
    startDate: string;
    endDate: string;
    shiftId: number;
    skipWeekends?: boolean;
    skipHolidays?: boolean;
  }): Promise<{ success: boolean; totalAssigned: number; failed: any[]; warnings: string[] }> {
    const response = await api.post('/hrm/shifts/assign/bulk', dto);
    return response.data;
  },

  async getEmployeeShiftCalendar(empCode: string, fromDate: string, toDate: string): Promise<ShiftAssignment[]> {
    const response = await api.get(`/hrm/shifts/calendar/${empCode}`, {
      params: { fromDate, toDate }
    });
    return response.data.data || [];
  },

  async deleteAssignment(id: number): Promise<boolean> {
    const response = await api.delete(`/hrm/shifts/assignment/${id}`);
    return response.data.success;
  },

  // Validation
  async validateAssignment(dto: {
    empCode: string;
    shiftId: number;
    assignmentDate: string;
  }): Promise<ShiftValidationResult> {
    const response = await api.post('/hrm/shifts/validate', dto);
    return response.data;
  },

  // Roster Templates
  async getRosterTemplates(): Promise<RosterTemplate[]> {
    const response = await api.get('/hrm/shifts/roster/templates');
    return response.data.data || [];
  },

  async generateRoster(dto: {
    templateId: number;
    monthYear: string;
    empCodes: string[] | 'ALL';
    generatedBy?: string;
  }): Promise<RosterGenerationResult> {
    const response = await api.post('/hrm/shifts/roster/generate', dto);
    return response.data;
  },

  // Violations
  async getViolations(fromDate: string, toDate: string): Promise<any[]> {
    const response = await api.get('/hrm/shifts/roster/violations', {
      params: { fromDate, toDate }
    });
    return response.data.data || [];
  },

  // Employee Shift Info
  async getEmployeeCurrentShift(empCode: string): Promise<{ data: ShiftAssignment | null; date: string }> {
    const response = await api.get(`/hrm/shifts/employee/${empCode}/current`);
    return response.data;
  },

  async getEmployeeShiftOnDate(empCode: string, date: string): Promise<{ data: ShiftAssignment | null; date: string }> {
    const response = await api.get(`/hrm/shifts/employee/${empCode}/on-date`, {
      params: { date }
    });
    return response.data;
  }
};

export default shiftService;
