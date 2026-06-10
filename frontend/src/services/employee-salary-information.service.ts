import { api, unwrapResponse } from './api';
import { EmployeeSalaryInformation, CreateEmployeeSalaryInformationData, UpdateEmployeeSalaryInformationData } from '@/types/employee-salary-information';

export const employeeSalaryInformationService = {
  async getAll(search?: string, searchType?: 'name' | 'acc_no'): Promise<EmployeeSalaryInformation[]> {
    const params: any = {};
    if (search) params.search = search;
    if (searchType) params.searchType = searchType;
    const response = await api.get('/employee-salary-information', { params });
    return unwrapResponse(response);
  },

  async getByACNo(acNo: string): Promise<EmployeeSalaryInformation> {
    const response = await api.get(`/employee-salary-information/by-acno/${acNo}`);
    return unwrapResponse(response);
  },

  async getByEmpCode(empCode: string): Promise<EmployeeSalaryInformation> {
    const response = await api.get(`/employee-salary-information/by-empcode/${empCode}`);
    return unwrapResponse(response);
  },

  async getById(id: number): Promise<EmployeeSalaryInformation> {
    const response = await api.get(`/employee-salary-information/${id}`);
    return unwrapResponse(response);
  },

  async create(data: CreateEmployeeSalaryInformationData): Promise<EmployeeSalaryInformation> {
    const response = await api.post('/employee-salary-information', data);
    return unwrapResponse(response);
  },

  async update(id: number, data: UpdateEmployeeSalaryInformationData): Promise<EmployeeSalaryInformation> {
    const response = await api.put(`/employee-salary-information/${id}`, data);
    return unwrapResponse(response);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/employee-salary-information/${id}`);
  },

  async updateDeductions(deductions: {
    empCode: string;
    absentAmount?: number;
    lateDeduct?: number;
    totalDeductions?: number;
    finalPayable?: number;
  }): Promise<any> {
    const response = await api.post('/employee-salary-information/update-deductions', deductions);
    return unwrapResponse(response);
  },
};
