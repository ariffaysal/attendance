'use client';

import { ReactNode } from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Loader2 } from 'lucide-react';

type Role = 'admin' | 'staff' | 'hr';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: Role[];
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * Component that wraps pages to enforce role-based access control
 * Only renders children if user has one of the allowed roles
 */
export function RoleGate({
  children,
  allowedRoles,
  redirectTo,
  fallback,
}: RoleGateProps) {
  const { isAllowed, isLoading } = useRoleAccess({
    allowedRoles,
    redirectTo,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!isAllowed) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-slate-400">You don't have permission to access this page</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
