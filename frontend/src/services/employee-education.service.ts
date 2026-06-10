import axios from 'axios';
import { EmployeeEducation, CreateEmployeeEducationData, UpdateEmployeeEducationData } from '@/types/employee-education';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const employeeEducationService = {
  async getAll(search?: string): Promise<EmployeeEducation[]> {
    const params = search ? { search } : {};
    const response = await axios.get(`${API_URL}/employee-education`, { params });
    return response.data;
  },

  async getByEmpCode(empCode: string): Promise<EmployeeEducation[]> {
    const response = await axios.get(`${API_URL}/employee-education/by-empcode/${empCode}`);
    return response.data;
  },

  async getById(id: number): Promise<EmployeeEducation> {
    const response = await axios.get(`${API_URL}/employee-education/${id}`);
    return response.data;
  },

  async create(data: CreateEmployeeEducationData): Promise<EmployeeEducation> {
    const response = await axios.post(`${API_URL}/employee-education`, data);
    return response.data;
  },

  async update(id: number, data: UpdateEmployeeEducationData): Promise<EmployeeEducation> {
    const response = await axios.put(`${API_URL}/employee-education/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await axios.delete(`${API_URL}/employee-education/${id}`);
  },
};
