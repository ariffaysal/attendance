import { api, unwrapResponse } from './api';

export interface EmployeeSalaryBreakdown {
  id?: number;
  empNo?: string;
  acNo?: string;
  no?: string;
  name?: string;
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

export type CreateEmployeeSalaryBreakdownData = Omit<EmployeeSalaryBreakdown, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmployeeSalaryBreakdownData = Partial<CreateEmployeeSalaryBreakdownData>;

export const employeeSalaryBreakdownService = {
  async getAll(search?: string): Promise<EmployeeSalaryBreakdown[]> {
    const params = search ? { search } : {};
    const response = await api.get('/employee-salary-breakdown', { params });
    return unwrapResponse(response);
  },

  async getByACNo(acNo: string): Promise<EmployeeSalaryBreakdown[]> {
    const response = await api.get(`/employee-salary-breakdown/by-acno/${acNo}`);
    return unwrapResponse(response);
  },

  async getByEmpCode(empCode: string): Promise<EmployeeSalaryBreakdown[]> {
    const response = await api.get(`/employee-salary-breakdown/by-empcode/${empCode}`);
    return unwrapResponse(response);
  },

  async getById(id: number): Promise<EmployeeSalaryBreakdown> {
    const response = await api.get(`/employee-salary-breakdown/${id}`);
    return unwrapResponse(response);
  },

  async create(data: CreateEmployeeSalaryBreakdownData): Promise<EmployeeSalaryBreakdown> {
    const response = await api.post('/employee-salary-breakdown', data);
    return unwrapResponse(response);
  },

  async update(id: number, data: UpdateEmployeeSalaryBreakdownData): Promise<EmployeeSalaryBreakdown> {
    const response = await api.put(`/employee-salary-breakdown/${id}`, data);
    return unwrapResponse(response);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/employee-salary-breakdown/${id}`);
  },
};
