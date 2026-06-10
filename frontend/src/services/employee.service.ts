import { api } from './api';
import { Employee, CreateEmployeeData } from '@/types/employee';

export interface EmployeeSuggestion {
  id: number;
  // 2 Identity Columns (source of truth from csv_employees)
  acNo: string;     // `AC-No.` from CSV
  name: string;     // `Name` from CSV
  // Legacy fields (for backward compatibility)
  emp_code: string;
  emp_id: string;
  full_name_english: string;
  full_name_bangla?: string;
  department?: string;
  designation?: string;
  company?: string;
  // Deprecated fields (kept for backward compatibility)
  empNo?: string;    // `Emp No.` from CSV (deprecated)
  no?: string;       // `No.` from CSV (deprecated)
}

export const employeeService = {
  async getAll(search?: string): Promise<Employee[]> {
    const response = await api.get('/employees', { params: { search } });
    return response.data;
  },

  async getById(id: number): Promise<Employee> {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  async create(data: CreateEmployeeData): Promise<Employee> {
    const response = await api.post('/employees', data);
    return response.data;
  },

  async update(id: number, data: CreateEmployeeData): Promise<Employee> {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/employees/${id}`);
  },

  /**
   * Get employee search suggestions for autocomplete
   */
  async getSearchSuggestions(query?: string, limit?: number, searchType?: 'name' | 'acc_no'): Promise<EmployeeSuggestion[]> {
    const params: any = { q: query };
    if (limit) params.limit = limit;
    if (searchType) params.searchType = searchType;
    const response = await api.get('/employees/search/suggestions', {
      params
    });
    return response.data;
  },

  /**
   * Validate if employee code exists
   */
  async validateEmployee(empCode: string): Promise<{ valid: boolean; employee: Employee }> {
    const response = await api.get(`/employees/validate/${empCode}`);
    return response.data;
  },

  /**
   * Lookup employee by code, ID, or name
   */
  async lookupEmployee(identifier: string): Promise<Employee> {
    const response = await api.get(`/employees/lookup/${identifier}`);
    return response.data;
  },
};
