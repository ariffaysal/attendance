'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EmployeeSalaryBankInfo {
  id?: number;
  empNo?: string;
  acNo?: string;
  no?: string;
  name?: string;
  empCode?: string;
  salaryBank: string;
  branchName: string;
  accountNo: string;
  salaryAmount: string;
  salaryPeriod: string;
  showTax: string;
  sequence: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeGroup {
  empCode: string;
  empName: string;
  department: string;
  bankCount: number;
  firstRecordId?: number;
}

export default function EmployeeSalaryBankInfoPage() {
  const [records, setRecords] = useState<EmployeeSalaryBankInfo[]>([]);
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadRecords();
  }, [debouncedSearch]);

  // Group records by employee
  useEffect(() => {
    if (records.length > 0) {
      const groups: Record<string, EmployeeGroup> = {};
      
      records.forEach((record) => {
        if (!groups[record.empCode || '']) {
          groups[record.empCode || ''] = {
            empCode: record.empCode || '',
            empName: record.name || '-',
            department: '-', // Would need to join with employee table
            bankCount: 0,
            firstRecordId: record.id,
          };
        }
        groups[record.empCode || ''].bankCount++;
      });
      
      setEmployeeGroups(Object.values(groups));
    } else {
      setEmployeeGroups([]);
    }
  }, [records]);

  async function loadRecords() {
    setLoading(true);
    setError(null);
    try {
      // For now, we'll use a mock service since the backend module exists
      // In a real implementation, you'd call the actual API
      const mockData: EmployeeSalaryBankInfo[] = [];
      setRecords(mockData);
    } catch (err: any) {
      console.error('Failed to load bank info records:', err);
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEmployee(empCode: string) {
    if (!confirm('Are you sure you want to delete the bank info record for this employee?')) return;

    try {
      // Implementation would call the delete API
      await loadRecords();
    } catch (err: any) {
      console.error('Failed to delete record:', err);
      alert('Failed to delete: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-60">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading bank information records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Employee Salary Bank Information</h4>
          <p className="text-muted mb-0 small">Manage employee bank details for salary disbursement</p>
        </div>
        <Link href="/employee-salary-bank-info/new" className="btn btn-primary">
          <i className="fas fa-plus me-2"></i> Add Bank Record
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">
              <i className="fas fa-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search by emp code, emp name, or bank name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card table-container">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Emp Code</th>
                <th>Emp Name</th>
                <th>Department</th>
                <th className="text-center">Bank Accounts</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeeGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5">
                    <div className="text-muted">
                      <i className="fas fa-university fa-2x mb-3 opacity-50"></i>
                      <p className="mb-0">No bank information records found.</p>
                      <p className="small text-muted mt-2">Click "Add Bank Record" to create one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employeeGroups.map((emp) => (
                  <tr key={emp.empCode}>
                    <td className="fw-medium text-primary">#{emp.empCode}</td>
                    <td>{emp.empName}</td>
                    <td>{emp.department}</td>
                    <td className="text-center">
                      <span className="badge bg-info fs-6">
                        {emp.bankCount}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group">
                        <Link
                          href={`/employee-salary-bank-info/emp/${emp.empCode}`}
                          className="btn btn-sm btn-outline-primary"
                          title="View Bank Details"
                        >
                          <i className="fas fa-eye"></i>
                        </Link>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteEmployee(emp.empCode)}
                          title="Delete Bank Record"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
