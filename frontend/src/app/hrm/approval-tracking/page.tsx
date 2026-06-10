'use client';

import Link from 'next/link';

const approvalOptions = [
  { href: '/hrm/approval-tracking/leave-approval', label: 'Leave Approval', icon: 'fa-calendar-check', desc: 'Approve employee leave requests' },
  { href: '/hrm/approval-tracking/travel-duty-approval', label: 'Travel & Duty Approval', icon: 'fa-plane', desc: 'Approve travel and duty assignments' },
  { href: '/hrm/approval-tracking/late-approval', label: 'Late Approval', icon: 'fa-clock', desc: 'Approve late arrival requests' },
  { href: '/hrm/approval-tracking/conveyance-approval', label: 'Conveyance Approval', icon: 'fa-car', desc: 'Approve conveyance and transport claims' },
  { href: '/hrm/approval-tracking/resource-requisition-approval', label: 'Resource Requisition Approval', icon: 'fa-clipboard-list', desc: 'Approve resource and asset requests' },
];

export default function ApprovalTrackingPage() {
  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <div>
          <h4 className="mb-1 fw-bold">Approval Tracking</h4>
          <p className="text-muted mb-0 small">HRM - Approval Tracking Dashboard</p>
        </div>
      </div>

      <div className="row g-4">
        {approvalOptions.map((option) => (
          <div key={option.href} className="col-md-6 col-lg-4">
            <Link href={option.href} className="text-decoration-none">
              <div className="card h-100 border-0 shadow-sm hover-shadow">
                <div className="card-body text-center py-4">
                  <div className="mb-3">
                    <i className={`fas ${option.icon} fa-3x text-primary opacity-75`}></i>
                  </div>
                  <h5 className="text-dark mb-2">{option.label}</h5>
                  <p className="text-muted small mb-0">{option.desc}</p>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
