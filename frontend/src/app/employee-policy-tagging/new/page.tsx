'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { employeePolicyTaggingService } from '@/services/employee-policy-tagging.service';
import { libraryService, Policy } from '@/services/library.service';
import { employeeService, EmployeeSuggestion } from '@/services/employee.service';
import EmployeeSearch from '@/components/EmployeeSearch';

// Dropdown options
const CATEGORIES = ['Top Management', 'Management', 'Executive', 'Non-Management', 'Contractual', 'Staff'];
const COMPANIES = ['Skyview Online Ltd.', 'Greenmax Technologies Ltd.'];
const LOCATIONS = ['Head Office', 'Corporate Office', 'Branch Office'];
const DEPARTMENTS = ['Accounts & Billing', 'NOC', 'Sales & Marketing', 'Transmission', 'Legal', 'Call Center & Support', 'Maintenance', 'General Administration'];

interface PolicyFormData {
  empCode: string;
  empName: string;
  category: string;
  company: string;
  location: string;
  division: string;
  department: string;
  section: string;
  subsection: string;
  designation: string;
  policies: {
    [key: string]: {
      ruleName: string;
      effectiveDate: string;
    };
  };
}

export default function NewPolicyTaggingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<PolicyFormData>({
    mode: 'onChange',
    defaultValues: {
      empCode: '',
      empName: '',
      category: '',
      company: '',
      location: '',
      division: '',
      department: '',
      section: '',
      subsection: '',
      designation: '',
      policies: {},
    },
  });

  // Watch employee fields for auto-populate
  const empCode = watch('empCode');
  const [searchDisplayValue, setSearchDisplayValue] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSuggestion | null>(null);
  const [validatingEmployee, setValidatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'name' | 'acc_no'>('name');

  // Load policies from library
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load policies with rules embedded
        const policiesResponse = await libraryService.getActivePoliciesWithRules();
        setPolicies(policiesResponse || []);
      } catch (error) {
        console.error('Failed to load policies:', error);
      } finally {
        setLoadingPolicies(false);
      }
    };

    loadData();
  }, []);

  // Handle employee selection from search
  const handleEmployeeSelect = async (employee: EmployeeSuggestion) => {
    setSelectedEmployee(employee);
    setEmployeeError(null);
    setDuplicateError(null);
    
    // Set display value based on search type
    if (searchType === 'acc_no') {
      setSearchDisplayValue(employee.acNo || employee.emp_code || '');
    } else {
      setSearchDisplayValue(employee.name || employee.full_name_english || '');
    }
    
    // Always populate AC-No. field with the actual AC-No. (empCode field maps to AC-No. in database)
    setValue('empCode', employee.acNo || employee.emp_code || '');
    
    // Populate only 2 identity fields from employee data
    setValue('empName', employee.name || employee.full_name_english || '');
    setValue('department', employee.department || '');
    setValue('designation', employee.designation || '');
    setValue('company', employee.company || '');
    
    // Validate if employee already has policy tagging
    try {
      setValidatingEmployee(true);
      // Use the AC-No. for validation (primary key for policy tagging)
      const acNoForValidation = employee.acNo || employee.emp_code || '';
      if (acNoForValidation) {
        const existing = await employeePolicyTaggingService.getByEmpCode(acNoForValidation);
        if (existing && existing.id) {
          setDuplicateError(`Employee ${employee.full_name_english} (${acNoForValidation}) already has policy tagging assigned.`);
        }
      }
    } catch (err) {
      // Employee doesn't have policy tagging yet - this is what we want
    } finally {
      setValidatingEmployee(false);
    }
  };

  // Handle manual empCode input validation
  const handleEmpCodeChange = async (value: string) => {
    // Don't trigger validation on every keystroke - only when user stops typing
    setSearchDisplayValue(value || '');
    setValue('empCode', ''); // Clear actual AC-No. when typing
    setEmployeeError(null);
    setDuplicateError(null);
    setSelectedEmployee(null); // Clear previous selection when typing
    
    // Only validate if it's a complete code (not while typing names)
    if (value && value.length >= 3 && searchType === 'acc_no') {
      try {
        setValidatingEmployee(true);
        const result = await employeeService.validateEmployee(value);
        if (result.valid && result.employee) {
          handleEmployeeSelect({
            id: result.employee.id,
            emp_code: result.employee.emp_code,
            emp_id: result.employee.emp_id,
            full_name_english: result.employee.full_name_english,
            full_name_bangla: result.employee.full_name_bangla,
            department: result.employee.department,
            designation: result.employee.designation,
            company: result.employee.company,
            // Required fields from EmployeeSuggestion interface
            acNo: result.employee.emp_code || '',
            name: result.employee.full_name_english || '',
            // Deprecated fields (for backward compatibility)
            empNo: result.employee.emp_id || '',
            no: result.employee.emp_code || '',
          });
        } else {
          // Don't show error while typing - only on blur or explicit search
          setSelectedEmployee(null);
        }
      } catch (err: any) {
        // Don't show error while typing - only on blur or explicit search
        setSelectedEmployee(null);
      } finally {
        setValidatingEmployee(false);
      }
    }
  };

  const onSubmit = async (data: PolicyFormData) => {
    setError(null);
    setDuplicateError(null);
    setSuccess(null);
    setSaving(true);

    // Validate employee exists before saving
    if (!selectedEmployee) {
      setEmployeeError('Please select a valid employee from system.');
      setSaving(false);
      return;
    }

    try {
      await employeePolicyTaggingService.create(data);
      setSuccess('Policy tagging saved successfully!');
      setTimeout(() => {
        router.push('/employee-policy-tagging');
      }, 1500);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (msg.includes('already has policy tagging')) {
        setDuplicateError(msg);
      } else {
        setError('Failed to save: ' + msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Assign Policies to Employee</h4>
          <p className="text-muted mb-0 small">Create new policy tagging record</p>
        </div>
        <Link href="/employee-policy-tagging" className="btn btn-outline-secondary">
          <i className="fas fa-arrow-left me-2"></i> Back to List
        </Link>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-user me-2"></i>Employee Details
          </h5>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="row g-3">
              <div className="col-md-6">
                <EmployeeSearch
                  label="Search Employee *"
                  value={searchDisplayValue}
                  onChange={handleEmpCodeChange}
                  onSelect={handleEmployeeSelect}
                  onSearchTypeChange={setSearchType}
                  searchType={searchType}
                  placeholder={searchType === 'acc_no' ? 'Enter AC-No.' : 'Enter employee name...'}
                  required
                />
                {employeeError && <div className="invalid-feedback d-block">{employeeError}</div>}
                {duplicateError && <div className="invalid-feedback d-block">{duplicateError}</div>}
                {validatingEmployee && (
                  <div className="small text-muted mt-1">
                    <i className="fas fa-spinner fa-spin me-1"></i> Validating employee...
                  </div>
                )}
                {selectedEmployee && !employeeError && !duplicateError && (
                  <div className="small text-success mt-1">
                    <i className="fas fa-check-circle me-1"></i> 
                    {selectedEmployee.full_name_english} validated
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium">AC-No.</label>
                <input
                  type="text"
                  className="form-control"
                  {...register('empCode', { required: true })}
                  placeholder="Auto-populated from selection"
                  readOnly
                />
                {errors.empCode && <div className="invalid-feedback d-block">AC-No is required</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium">Emp Name</label>
                <input
                  type="text"
                  className="form-control"
                  {...register('empName', { required: true })}
                  placeholder="Auto-populated from selection"
                  readOnly
                />
                {errors.empName && <div className="invalid-feedback d-block">Emp Name is required</div>}
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Category</label>
                <select {...register('category')} className="form-select">
                  <option value="">Select</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Company</label>
                <select {...register('company')} className="form-select">
                  <option value="">Select</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Location</label>
                <select {...register('location')} className="form-select">
                  <option value="">Select</option>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Division</label>
                <select {...register('division')} className="form-select">
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Department</label>
                <select {...register('department')} className="form-select">
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Section</label>
                <select {...register('section')} className="form-select">
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Subsection</label>
                <select {...register('subsection')} className="form-select">
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Designation</label>
                <select {...register('designation')} className="form-select">
                  <option value="">Select</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <h5 className="mb-3 fw-bold text-primary">
              <i className="fas fa-shield-alt me-2"></i>Policy Mapping
            </h5>
            
            {loadingPolicies ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary mb-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted mb-0">Loading policies from Library...</p>
              </div>
            ) : policies.length === 0 ? (
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                No active policies found in Library. Please create policies in <Link href="/library/policies" className="alert-link">Library</Link> first.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '40%' }}>Policy Name</th>
                      <th style={{ width: '35%' }}>Rule Name</th>
                      <th style={{ width: '25%' }}>Effective Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id}>
                        <td className="align-middle">
                          <span className="fw-medium">{policy.policy_name}</span>
                          <div className="small text-muted">{policy.policy_code}</div>
                        </td>
                        <td>
                          <select {...register(`policies.${policy.policy_name}.ruleName`)} className="form-select form-select-sm">
                            <option value="">Select Rule</option>
                            {policy.rules?.map((rule: any) => (
                              <option key={rule.id} value={rule.rule_name}>{rule.rule_name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input 
                            type="date" 
                            {...register(`policies.${policy.policy_name}.effectiveDate`)} 
                            className="form-control form-control-sm" 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Policy Tagging'}
              </button>
              <Link href="/employee-policy-tagging" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show position-fixed" style={{ top: '20px', right: '20px', zIndex: 1050 }} role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible fade show position-fixed" style={{ top: '20px', right: '20px', zIndex: 1050 }} role="alert">
          <i className="fas fa-check-circle me-2"></i>
          {success}
        </div>
      )}
    </div>
  );
}
function setShiftOptions(shiftsData: { label: string; value: string; shift_code: string; start_time: string; end_time: string; grace_period_minutes: number; }[]) {
  throw new Error('Function not implemented.');
}

