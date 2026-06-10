'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

interface CsvEmployee {
  'Emp No.': string;
  'AC-No.': string;
  'No.': string;
  'Name': string;
  Department: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<CsvEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadEmployees();
    }
  }, [isAuthenticated]);

  async function loadEmployees() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/attendance/csv-employees');
      setEmployees(response.data);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(employees.map(emp => emp['AC-No.'])));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (acNo: string, checked: boolean) => {
    const newSelected = new Set(selectedEmployees);
    if (checked) {
      newSelected.add(acNo);
    } else {
      newSelected.delete(acNo);
    }
    setSelectedEmployees(newSelected);
  };

  const handleRemoveData = async () => {
    if (selectedEmployees.size === 0) {
      setError('Please select at least one employee to remove');
      return;
    }

    if (!confirm(`Are you sure you want to remove data for ${selectedEmployees.size} employee(s)? This will remove No., Name, and Department from the employees table.`)) {
      return;
    }

    setRemoving(true);
    setError(null);
    try {
      await api.post('/attendance/remove-employee-data', {
        acNos: Array.from(selectedEmployees)
      });
      
      // Reload employees
      await loadEmployees();
      setSelectedEmployees(new Set());
      alert('Employee data removed successfully');
    } catch (err: any) {
      console.error('Failed to remove employee data:', err);
      setError(err.message || 'Failed to remove employee data');
    } finally {
      setRemoving(false);
    }
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <div>
          <h4 className="mb-1 fw-bold">CSV Employees</h4>
          <p className="text-muted mb-0 small">
            Employees from CSV uploads
          </p>
        </div>
        {selectedEmployees.size > 0 && (
          <button
            className="btn btn-danger"
            onClick={handleRemoveData}
            disabled={removing}
          >
            {removing ? (
              <><i className="fas fa-spinner fa-spin me-2"></i>Removing...</>
            ) : (
              <><i className="fas fa-trash me-2"></i>Remove Data ({selectedEmployees.size})</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-2">Loading employees...</p>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedEmployees.size === employees.length && employees.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>AC-No.</th>
                    <th>No.</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-5">
                        <div className="mb-3">
                          <i className="fas fa-users fa-3x text-muted opacity-50"></i>
                        </div>
                        <p className="text-muted mb-0">No employees found. Upload a CSV file to add employees.</p>
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp['AC-No.']}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedEmployees.has(emp['AC-No.'])}
                            onChange={(e) => handleSelectEmployee(emp['AC-No.'], e.target.checked)}
                          />
                        </td>
                        <td className="fw-semibold">{emp['AC-No.'] || '-'}</td>
                        <td>{emp['No.'] || '-'}</td>
                        <td>{emp['Name'] || '-'}</td>
                        <td>{emp['Department'] || '-'}</td>
                        <td>
                          <span className={`badge ${emp.is_active ? 'bg-success' : 'bg-secondary'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="small text-muted">
                          {emp.updated_at ? new Date(emp.updated_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
