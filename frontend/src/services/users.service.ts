import { api } from './api';
import { Role } from './auth.service';

export interface User {
  id: number;
  employeeId: string;
  email: string;
  mobileNumber?: string;
  isActive: boolean;
  role?: Role;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  employeeId: string;
  email: string;
  mobileNumber?: string;
  password: string;
  isActive?: boolean;
  role?: Role;
}

export interface UpdateUserData {
  employeeId?: string;
  email?: string;
  mobileNumber?: string;
  password?: string;
  isActive?: boolean;
  role?: Role;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export const usersService = {
  async getAllUsers(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data;
  },

  async getUserById(id: number): Promise<User> {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  async createUser(data: CreateUserData): Promise<ApiResponse> {
    const response = await api.post('/users', data);
    return response.data;
  },

  async updateUser(id: number, data: UpdateUserData): Promise<ApiResponse> {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: number): Promise<ApiResponse> {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};
