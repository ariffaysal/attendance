'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { attendanceService } from '@/services/attendance.service';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Attendance',
    icon: 'fa-fingerprint',
    children: [
      { href: '/', label: 'Dashboard', icon: 'fa-chart-line' },
      { href: '/job-cards', label: 'Job Cards', icon: 'fa-id-card' },
      { href: '/monthly', label: 'Reports', icon: 'fa-calendar-alt' },
      { href: '/salary-sheet', label: 'Salary Sheet', icon: 'fa-file-invoice-dollar' },
      { href: '/csv-upload', label: 'Upload CSV', icon: 'fa-file-csv' },
    ],
  },
  {
    label: 'Employees',
    icon: 'fa-users',
    children: [
      { href: '/employees', label: 'Employees', icon: 'fa-user' },
      { href: '/employee-address', label: 'Employee Address', icon: 'fa-map-marker-alt' },
      { href: '/employee-education', label: 'Employee Education Information', icon: 'fa-graduation-cap' },
      { href: '/employee-policy-tagging', label: 'Employee Policy Tagging Information', icon: 'fa-tags' },
      { href: '/employee-salary-information', label: 'Employee Salary Information', icon: 'fa-money-bill-wave' },
    ],
  },
  {
    label: 'Library',
    icon: 'fa-book',
    children: [
      { href: '/library', label: 'Library Dashboard', icon: 'fa-book-open' },
      { href: '/library/policies', label: 'Manage Policies', icon: 'fa-list-check' },
      { href: '/employee-policy-tagging', label: 'Assign to Employees', icon: 'fa-user-tag' },
      { href: '/library/assign-users', label: 'Assign Users', icon: 'fa-user-plus' },
    ],
  },
  {
    label: 'Human Resource Management',
    icon: 'fa-users-cog',
    children: [
      { href: '/hrm', label: 'HRM Dashboard', icon: 'fa-tachometer-alt' },
      {
        label: 'Approval Tracking',
        icon: 'fa-check-double',
        children: [
          { href: '/hrm/approval-tracking/leave-approval', label: 'Leave Approval', icon: 'fa-calendar-check' },
          { href: '/hrm/approval-tracking/travel-duty-approval', label: 'Travel & Duty Approval', icon: 'fa-plane' },
          { href: '/hrm/approval-tracking/late-approval', label: 'Late Approval', icon: 'fa-clock' },
          { href: '/hrm/approval-tracking/conveyance-approval', label: 'Conveyance Approval', icon: 'fa-car' },
          { href: '/hrm/approval-tracking/resource-requisition-approval', label: 'Resource Requisition Approval', icon: 'fa-clipboard-list' },
        ],
      },
      {
        label: 'Attendance Management',
        icon: 'fa-clipboard-check',
        children: [
          { href: '/hrm/attendance-management/define-holiday', label: 'Define Holiday', icon: 'fa-calendar-day' },
          { href: '/hrm/attendance-management/define-weekend', label: 'Define Weekend', icon: 'fa-calendar-week' },
          { href: '/hrm/attendance-management/duty-roster', label: 'Duty Roster', icon: 'fa-clipboard-list' },
          { href: '/hrm/attendance-management/process-holiday', label: 'Process Holiday', icon: 'fa-cogs' },
          { href: '/hrm/attendance-management/remove-manual-attendance', label: 'Remove Manual Attendance Entry', icon: 'fa-eraser' },
          { href: '/hrm/attendance-management/shift-assignment', label: 'Shift Assignment', icon: 'fa-business-time' },
          { href: '/hrm/attendance-management/temporary-shift-assignment', label: 'Temporary Shift Assignment', icon: 'fa-clock' },
        ],
      },
      {
        label: 'Leave Management',
        icon: 'fa-calendar-minus',
        children: [
          { href: '/hrm/leave-management/leave-approval', label: 'Leave Approval', icon: 'fa-check-circle' },
          { href: '/hrm/leave-management/leave-delete', label: 'Leave Delete', icon: 'fa-trash-alt' },
          { href: '/hrm/leave-management/leave-entry', label: 'Leave Entry', icon: 'fa-plus-circle' },
          { href: '/hrm/leave-management/opening-leave-entry', label: 'Opening Leave Entry', icon: 'fa-door-open' },
          { href: '/hrm/leave-management/maternity-leave-entry', label: 'Maternity Leave Entry', icon: 'fa-baby' },
        ],
      },
      { href: '/hrm/budgeted-manpower', label: 'Budgeted Manpower', icon: 'fa-users' },
      {
        label: 'Setup Data Management',
        icon: 'fa-cogs',
        children: [
          { href: '/hrm/setup-data/bulk-data-processing', label: 'Bulk Data Processing', icon: 'fa-database' },
          { href: '/hrm/setup-data/data-synchronization', label: 'Data Synchronization', icon: 'fa-sync-alt' },
          { href: '/hrm/setup-data/upload-employee-info', label: 'Upload Employee Info', icon: 'fa-cloud-upload-alt' },
          { href: '/hrm/setup-data/data-re-process', label: 'Data Re-Process', icon: 'fa-redo-alt' },
        ],
      },
      {
        label: 'Disciplinary',
        icon: 'fa-gavel',
        children: [
          { href: '/hrm/disciplinary/employee-disciplinary-info', label: 'Employee Disciplinary Information', icon: 'fa-user-slash' },
          { href: '/hrm/disciplinary/job-reactivation', label: 'Employee Job Re-activation', icon: 'fa-user-check' },
          { href: '/hrm/disciplinary/job-separation', label: 'Employee Job Separation', icon: 'fa-user-times' },
          { href: '/hrm/disciplinary/transfer-entry', label: 'Employee Transfer Entry', icon: 'fa-exchange-alt' },
        ],
      },
      { href: '/hrm/employee-info', label: 'Employee Information', icon: 'fa-id-card' },
      {
        label: 'Payment Management',
        icon: 'fa-money-check-alt',
        children: [
          { href: '/hrm/payment-management/bonus-process', label: 'Bonus Process', icon: 'fa-gift' },
          { href: '/hrm/payment-management/fraction-month-salary', label: 'Fraction Month Salary Process', icon: 'fa-calculator' },
          { href: '/hrm/payment-management/increment-entry', label: 'Increment Entry', icon: 'fa-chart-line' },
          { href: '/hrm/payment-management/salary-period-lock', label: 'Salary Period Lock', icon: 'fa-lock' },
          { href: '/hrm/payment-management/salary-process', label: 'Salary Process', icon: 'fa-money-bill-wave' },
        ],
      },
      {
        label: 'Pending List',
        icon: 'fa-hourglass-half',
        children: [
          { href: '/hrm/pending-list/increment-pending', label: 'Increment Pending', icon: 'fa-chart-line' },
          { href: '/hrm/pending-list/job-confirmation-pending', label: 'Job Confirmation Pending', icon: 'fa-user-check' },
          { href: '/hrm/pending-list/promotion-pending', label: 'Promotion Pending', icon: 'fa-arrow-up' },
          { href: '/hrm/pending-list/transfer-pending', label: 'Transfer Pending', icon: 'fa-exchange-alt' },
        ],
      },
      { href: '/hrm/reports', label: 'Reports', icon: 'fa-file-alt' },
    ],
  },
  {
    label: 'Policy Leave',
    icon: 'fa-file-signature',
    children: [
      { href: '/hrm/leave-management/opening-leave-entry', label: 'Opening Leave Entry', icon: 'fa-door-open' },
      { href: '/hrm/leave-management/leave-entry', label: 'Leave Entry', icon: 'fa-plus-circle' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(null);
  const { user, logout } = useAuth();

  const filteredNavItems = navItems.map(item => {
    if (user?.role === 'staff') {
      if (item.label === 'Attendance') {
        return {
          ...item,
          children: item.children?.filter(child =>
            ['Dashboard', 'Job Cards', 'Reports'].includes(child.label)
          )
        };
      }
      return null;
    }

    if (user?.role === 'hr' && item.label === 'Library') {
      return {
        ...item,
        children: item.children?.filter(child => child.href !== '/library/assign-users'),
      };
    }

    return item;
  }).filter(Boolean) as NavItem[];

  const toggleMenu = (label: string) => {
    setExpandedMenu(expandedMenu === label ? null : label);
  };

  const toggleSubMenu = (label: string) => {
    setExpandedSubMenu(expandedSubMenu === label ? null : label);
  };

  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(href + '/');
  const isChildActive = (children?: NavItem[]): boolean | undefined => children?.some(child => child.href ? isActive(child.href) : child.children ? isChildActive(child.children) : false);

  const handleReset = async () => {
    if (confirm('This will wipe all attendance data. Continue?')) {
      try {
        await attendanceService.clearData();
        window.location.href = '/';
      } catch (error) {
        console.error('Failed to reset data:', error);
        alert('Failed to reset data. Please try again.');
      }
    }
  };

  return (
    <div className="sidebar no-print">
      <div className="sidebar-brand">
        <Link href="/skyview" className="text-decoration-none">
          <h4 className="text-white">
            <i className="fas fa-fingerprint"></i>
            <span>SkyView Attendance</span>
          </h4>
        </Link>
      </div>
      <div className="sidebar-nav">
        {filteredNavItems.map((item) => (
          <div key={item.label}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`nav-link nav-link-parent ${isChildActive(item.children) ? 'active' : ''}`}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
                  <i className={`fas fa-chevron-down submenu-arrow ${expandedMenu === item.label ? 'expanded' : ''}`}></i>
                </button>
                <div className={`submenu ${expandedMenu === item.label ? 'expanded' : ''}`}>
                  {item.children.map((child) => (
                    <div key={child.label}>
                      {child.children ? (
                        <>
                          <button
                            onClick={() => toggleSubMenu(child.label)}
                            className={`nav-link nav-link-child nested-level-1 ${isChildActive(child.children) ? 'active' : ''}`}
                          >
                            <i className={`fas ${child.icon}`}></i>
                            <span>{child.label}</span>
                            <i className={`fas fa-chevron-down submenu-arrow nested-arrow ${expandedSubMenu === child.label ? 'expanded' : ''}`}></i>
                          </button>
                          <div className={`submenu nested ${expandedSubMenu === child.label ? 'expanded' : ''}`}>
                            {child.children.map((grandChild) => (
                              <Link
                                key={grandChild.href}
                                href={grandChild.href || '#'}
                                className={`nav-link nav-link-child nested-level-2 ${pathname === grandChild.href ? 'active' : ''}`}
                              >
                                <i className={`fas ${grandChild.icon}`}></i>
                                {grandChild.label}
                              </Link>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Link
                          href={child.href || '#'}
                          className={`nav-link nav-link-child ${pathname === child.href ? 'active' : ''}`}
                        >
                          <i className={`fas ${child.icon}`}></i>
                          {child.label}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Link
                href={item.href || '#'}
                className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              >
                <i className={`fas ${item.icon}`}></i>
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        {user && (
          <div className="px-3 pb-3">
            <div className="text-white text-sm mb-1">
              <i className="fas fa-user me-2"></i>
              <span className="fw-semibold">{user.employeeId}</span>
            </div>
            <div className="text-slate-400 text-xs mb-1">
              {user.email}
            </div>
            <div className="text-slate-400 text-xs mb-3">
              Role: {user.role === 'admin' ? 'Admin' : user.role === 'hr' ? 'HR' : 'Staff'}
            </div>
          </div>
        )}
        <button
          className="btn btn-outline-light btn-sm w-100 mb-2"
          onClick={logout}
        >
          <i className="fas fa-sign-out-alt me-2"></i> Logout
        </button>
        {['admin', 'hr'].includes(user?.role || '') && (
          <button
            className="btn btn-outline-danger btn-sm w-100"
            onClick={handleReset}
          >
            <i className="fas fa-trash-alt me-2"></i> Reset Data
          </button>
        )}
      </div>
    </div>
  );
}
