'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { employeeSalaryInformationService } from '@/services/employee-salary-information.service';
import { EmployeeSalaryInformation } from '@/types/employee-salary-information';

interface EmployeeGroup {
  empCode: string;
  empId: string;
  empName: string;
  acNo: string;        // Add AC-No. field
  department: string;
  designation: string;
  grossSalary: string;
  bankCount: number;
  firstRecordId?: number;
}

export default function EmployeeSalaryInformationDashboard() {
  const [records, setRecords] = useState<EmployeeSalaryInformation[]>([]);
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'acc_no'>('name');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedSearchType, setDebouncedSearchType] = useState<'name' | 'acc_no'>('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedSearchType(searchType);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchType]);

  useEffect(() => {
    loadRecords();
  }, [debouncedSearch, debouncedSearchType]);

  // Group records by employee
  useEffect(() => {
    if (records.length > 0) {
      const groups: Record<string, EmployeeGroup> = {};
      
      records.forEach((record) => {
        // Use acNo or no as the unique key since empCode is undefined
        const uniqueKey = record.acNo || record.no || record.empId || `id-${record.id}`;
        
        if (!groups[uniqueKey]) {
          groups[uniqueKey] = {
            empCode: record.empCode || uniqueKey,
            empId: record.empId,
            empName: record.empName,
            acNo: record.acNo || '',        // Add AC-No. field
            department: record.department,
            designation: record.designation,
            grossSalary: record.grossSalary,
            bankCount: 0,
            firstRecordId: record.id
          };
        }
        groups[uniqueKey].bankCount += (record.bankInfos?.length || 0);
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
      const data = await employeeSalaryInformationService.getAll(debouncedSearch, debouncedSearchType);
      setRecords(data);
    } catch (err: any) {
      console.error('Failed to load salary information records:', err);
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEmployee(empCode: string) {
    if (!confirm('Are you sure you want to delete the salary information record for this employee?')) return;

    try {
      const record = await employeeSalaryInformationService.getByEmpCode(empCode);
      if (record && record.id) {
        await employeeSalaryInformationService.delete(record.id);
        await loadRecords();
      }
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
          <p className="text-muted">Loading salary information records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Employee Salary Information</h4>
          <p className="text-muted mb-0 small">Manage employee salary and bank details</p>
        </div>
        <Link href="/employee-salary-information/new" className="btn btn-primary">
          <i className="fas fa-plus me-2"></i> Add Salary Record
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
          <form onSubmit={(e) => { e.preventDefault(); loadRecords(); }} className="search-bar no-print">
            <span className="text-muted fw-bold me-2">Search by:</span>

            {/* Search Type Dropdown */}
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'name' | 'acc_no')}
              className="form-select"
              style={{ width: '120px' }}
              title="Select search type"
              aria-label="Search type"
            >
              <option value="name">Name</option>
              <option value="acc_no">AC-No.</option>
            </select>

            <input
              type="text"
              className="form-control search-input"
              placeholder={searchType === 'acc_no' ? 'Enter AC-No.' : 'Enter employee name...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button type="submit" className="btn btn-primary">
              <i className="fas fa-search"></i>
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="card table-container">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>AC-No.</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Gross Salary</th>
                <th className="text-center">Bank Accounts</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeeGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="text-muted">
                      <i className="fas fa-money-bill-wave fa-2x mb-3 opacity-50"></i>
                      <p className="mb-0">No salary information records found.</p>
                      <p className="small text-muted mt-2">Click "Add Salary Record" to create one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employeeGroups.map((emp) => (
                  <tr key={emp.empCode}>
                    <td className="fw-medium text-primary">{emp.acNo || emp.empCode}</td>
                    <td>{emp.empName}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.grossSalary}</td>
                    <td className="text-center">
                      <span className="badge bg-info fs-6">
                        {emp.bankCount}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group">
                        <Link
                          href={`/employee-salary-information/emp-code/${emp.acNo || emp.empCode}`}
                          className="btn btn-sm btn-outline-primary"
                          title="View Salary Details"
                        >
                          <i className="fas fa-eye"></i>
                        </Link>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteEmployee(emp.acNo || emp.empCode)}
                          title="Delete Salary Record"
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
