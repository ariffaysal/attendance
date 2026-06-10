'use client';

import { RoleGate } from '@/components/RoleGate';

export default function PolicyLeavePage() {
  return (
    <RoleGate allowedRoles={['admin', 'hr']}>
      <div className="fade-in">
        <div className="top-bar mb-4">
          <div>
            <h4 className="mb-1 fw-bold">Policy Leave</h4>
            <p className="text-muted mb-0 small">Policy leave management for HR and Admin</p>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="mb-4">
              <i className="fas fa-file-signature fa-4x text-primary opacity-50"></i>
            </div>
            <h5 className="text-muted mb-3">Policy Leave Module</h5>
            <p className="text-muted mb-0">
              This page is ready for policy leave features.
            </p>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
