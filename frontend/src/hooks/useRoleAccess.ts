import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Role = 'admin' | 'staff' | 'hr';

type AllowedRoles = Role;

interface UseRoleAccessOptions {
  allowedRoles: AllowedRoles[];
  redirectTo?: string;
}

/**
 * Hook to check and enforce role-based access control
 * @param allowedRoles - Array of roles that are allowed to access
 * @param redirectTo - Path to redirect if user doesn't have access (default: /skyview)
 * @returns Object with isAllowed and isLoading flags
 */
export function useRoleAccess(options: UseRoleAccessOptions) {
  const { user, isLoading, userRole } = useAuth();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user || !userRole) {
      router.push('/login');
      return;
    }

    if (options.allowedRoles.includes(userRole)) {
      setIsAllowed(true);
    } else {
      // Redirect to unauthorized page or home
      router.push(options.redirectTo || '/skyview');
    }
  }, [user, isLoading, userRole, router, options.allowedRoles, options.redirectTo]);

  return {
    isAllowed,
    isLoading,
    userRole,
  };
}

/**
 * Define which roles can access which pages
 */
export const PAGE_PERMISSIONS = {
  '/job-cards': ['admin', 'staff', 'hr'],
  '/reports': ['admin', 'staff', 'hr'],
  '/library': ['admin', 'hr'],
  '/library/assign-users': ['admin'],
  '/employee-policy-tagging': ['admin', 'hr'],
  '/employees': ['admin', 'hr'],
  '/users': ['admin'],
  '/hrm': ['admin', 'hr'],
  '/policy-leave': ['admin', 'hr'],
  '/salary-sheet': ['admin', 'hr'],
  '/shift-assignments': ['admin', 'hr'],
} as const;
