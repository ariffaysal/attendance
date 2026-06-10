'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, Role } from '@/services/auth.service';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: Role | null;
  login: (employeeId: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (employeeId: string, email: string, mobileNumber: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasAccess: (requiredRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = authService.getCurrentUser();
    // Validate that stored user has required fields
    if (storedUser && storedUser.id && storedUser.employeeId) {
      setUser(storedUser);
      // Re-sync cookie for middleware (cookie might have been cleared)
      authService.syncCookie(storedUser.employeeId);
    } else {
      // Clear invalid data
      authService.logout();
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const login = async (employeeId: string, password: string) => {
    try {
      const response = await authService.login({ employeeId, password });
      if (response.success && response.user) {
        setUser(response.user);
      }
      return { success: response.success, message: response.message };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  };

  const register = async (employeeId: string, email: string, mobileNumber: string, password: string) => {
    try {
      const response = await authService.register({ employeeId, email, mobileNumber, password });
      return { success: response.success, message: response.message };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    window.location.href = '/skyview';
  };

  const hasRole = (role: Role): boolean => {
    return user?.role === role;
  };

  const hasAccess = (requiredRoles: Role[]): boolean => {
    return user ? requiredRoles.includes(user.role as Role) : false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        userRole: user?.role as Role | null,
        login,
        register,
        logout,
        hasRole,
        hasAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
