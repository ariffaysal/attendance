import axios from 'axios';
import { EmployeeAddress, CreateEmployeeAddressData, UpdateEmployeeAddressData } from '@/types/employee-address';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const employeeAddressService = {
  async getAll(search?: string): Promise<EmployeeAddress[]> {
    const params = search ? { search } : {};
    const response = await axios.get(`${API_URL}/employee-addresses`, { params });
    return response.data;
  },

  async getByACNo(acNo: string): Promise<EmployeeAddress> {
    const response = await axios.get(`${API_URL}/employee-addresses/by-acno/${acNo}`);
    return response.data;
  },

  async getByEmpCode(empCode: string): Promise<EmployeeAddress> {
    const response = await axios.get(`${API_URL}/employee-addresses/by-empcode/${empCode}`);
    return response.data;
  },

  async getById(id: number): Promise<EmployeeAddress> {
    const response = await axios.get(`${API_URL}/employee-addresses/${id}`);
    return response.data;
  },

  async create(data: CreateEmployeeAddressData): Promise<EmployeeAddress> {
    const response = await axios.post(`${API_URL}/employee-addresses`, data);
    return response.data;
  },

  async update(id: number, data: UpdateEmployeeAddressData): Promise<EmployeeAddress> {
    const response = await axios.put(`${API_URL}/employee-addresses/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await axios.delete(`${API_URL}/employee-addresses/${id}`);
  },
};
