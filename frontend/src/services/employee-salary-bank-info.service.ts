import { api, unwrapResponse } from './api';

export interface EmployeeSalaryBankInfo {
  id?: number;
  empNo?: string;
  acNo?: string;
  no?: string;
  name?: string;
  empCode?: string;
  salaryBank: string;
  branchName: string;
  accountNo: string;
  salaryAmount: string;
  salaryPeriod: string;
  showTax: string;
  sequence: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateEmployeeSalaryBankInfoData = Omit<EmployeeSalaryBankInfo, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmployeeSalaryBankInfoData = Partial<CreateEmployeeSalaryBankInfoData>;

export const employeeSalaryBankInfoService = {
  async getAll(search?: string): Promise<EmployeeSalaryBankInfo[]> {
    const params = search ? { search } : {};
    const response = await api.get('/employee-salary-bank-info', { params });
    return unwrapResponse(response);
  },

  async getByACNo(acNo: string): Promise<EmployeeSalaryBankInfo[]> {
    const response = await api.get(`/employee-salary-bank-info/by-acno/${acNo}`);
    return unwrapResponse(response);
  },

  async getByEmpCode(empCode: string): Promise<EmployeeSalaryBankInfo[]> {
    const response = await api.get(`/employee-salary-bank-info/by-empcode/${empCode}`);
    return unwrapResponse(response);
  },

  async getById(id: number): Promise<EmployeeSalaryBankInfo> {
    const response = await api.get(`/employee-salary-bank-info/${id}`);
    return unwrapResponse(response);
  },

  async create(data: CreateEmployeeSalaryBankInfoData): Promise<EmployeeSalaryBankInfo> {
    const response = await api.post('/employee-salary-bank-info', data);
    return unwrapResponse(response);
  },

  async update(id: number, data: UpdateEmployeeSalaryBankInfoData): Promise<EmployeeSalaryBankInfo> {
    const response = await api.put(`/employee-salary-bank-info/${id}`, data);
    return unwrapResponse(response);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/employee-salary-bank-info/${id}`);
  },
};
