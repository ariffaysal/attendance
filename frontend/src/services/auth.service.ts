import { api } from './api';

export type Role = 'admin' | 'staff' | 'hr';

export interface LoginData {
  employeeId: string;
  password: string;
}

export interface RegisterData {
  employeeId: string;
  email: string;
  mobileNumber: string;
  password: string;
}

export interface ForgotPasswordData {
  employeeId: string;
}

export interface VerifyCodeData {
  employeeId: string;
  code: string;
}

export interface ResetPasswordData {
  employeeId: string;
  code: string;
  newPassword: string;
}

export interface User {
  id: number;
  employeeId: string;
  email: string;
  mobileNumber: string;
  role?: Role;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  maskedEmail?: string;
}

const STORAGE_KEY = 'auth_user';
const COOKIE_KEY = 'auth_user';

// Helper to set cookie
function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

// Helper to remove cookie
function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const authService = {
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    if (response.data.success && response.data.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data.user));
      // Also set a cookie for middleware detection
      setCookie(COOKIE_KEY, response.data.user.employeeId);
    }
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    removeCookie(COOKIE_KEY);
  },

  syncCookie(employeeId: string): void {
    // Re-set cookie to ensure middleware can detect auth state
    setCookie(COOKIE_KEY, employeeId);
  },

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  },

  async forgotPassword(data: ForgotPasswordData): Promise<ForgotPasswordResponse> {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },

  async verifyCode(data: VerifyCodeData): Promise<AuthResponse> {
    const response = await api.post('/auth/verify-code', data);
    return response.data;
  },

  async resetPassword(data: ResetPasswordData): Promise<AuthResponse> {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
};
