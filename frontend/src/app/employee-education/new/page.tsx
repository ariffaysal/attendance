'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeeEducationService } from '@/services/employee-education.service';
import { employeeService, EmployeeSuggestion } from '@/services/employee.service';
import { CreateEmployeeEducationData } from '@/types/employee-education';
import EmployeeSearch from '@/components/EmployeeSearch';

// Dropdown options
const CATEGORIES = ['Top Management', 'Management', 'Executive', 'Non-Management', 'Contractual', 'Staff'];
const COMPANIES = ['Skyview Online Ltd.', 'Greenmax Technologies Ltd.'];
const LOCATIONS = ['Head Office', 'Corporate Office', 'Branch Office'];
const DEPARTMENTS = ['Accounts & Billing', 'NOC', 'Sales & Marketing', 'Transmission', 'Legal', 'Call Center & Support', 'Maintenance', 'General Administration'];
const EDUCATION_NATURES = ['Full Time', 'Part Time', 'Distance Learning', 'Online', 'Correspondence'];
const RESULTS = ['First Class', 'Second Class', 'Third Class', 'Distinction', 'Merit', 'Pass'];

export default function NewEmployeeEducationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSuggestion | null>(null);
  const [validatingEmployee, setValidatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'name' | 'acc_no'>('name');

  // Form state
  const [empCode, setEmpCode] = useState('');
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empNo, setEmpNo] = useState('');    // Emp No. field
  const [acNo, setAcNo] = useState('');      // AC-No. field  
  const [no, setNo] = useState('');          // No. field
  const [category, setCategory] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [division, setDivision] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [subsection, setSubsection] = useState('');
  const [designation, setDesignation] = useState('');

  // Education details
  const [courseName, setCourseName] = useState('');
  const [board, setBoard] = useState('');
  const [institution, setInstitution] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [majorSubject, setMajorSubject] = useState('');
  const [year, setYear] = useState('');
  const [result, setResult] = useState('');
  const [educationNature, setEducationNature] = useState('');

  // Handle employee selection from search
  const handleEmployeeSelect = async (employee: EmployeeSuggestion) => {
    setSelectedEmployee(employee);
    setEmployeeError(null);
    setDuplicateError(null);
    
    // Auto-populate form fields with all 4 identity columns
    // Use the proper CSV identity fields from EmployeeSuggestion interface
    setEmpNo(employee.empNo || '');  // empNo is the Emp No. from CSV
    setAcNo(employee.acNo || '');     // acNo is the AC-No. from CSV
    setNo(employee.no || '');         // no is the No. from CSV
    setEmpName(employee.name || '');  // name is the Name from CSV
    
    // Legacy fields for compatibility
    setEmpId(employee.empNo || employee.emp_id || '');
    setEmpCode(employee.acNo || employee.emp_code || '');
    
    // Additional fields
    setDepartment(employee.department || '');
    setDesignation(employee.designation || '');
    setCompany(employee.company || '');
    
    // Validate if employee already has education records
    try {
      setValidatingEmployee(true);
      const existing = await employeeEducationService.getByEmpCode(employee.emp_code || employee.acNo || employee.no);
      if (existing && existing.length > 0) {
        setDuplicateError(`Employee ${employee.name || employee.full_name_english} (${employee.emp_code || employee.acNo}) already has education records. You can view and edit existing records.`);
      }
    } catch (err) {
      // Employee doesn't have education records yet - this is what we want
    } finally {
      setValidatingEmployee(false);
    }
  };

  // Handle manual empCode input validation
  const handleEmpCodeChange = async (value: string) => {
    setEmpCode(value || '');
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
            empNo: result.employee.emp_id || '',  // emp_id maps to Emp No.
            acNo: result.employee.emp_code || '',
            no: result.employee.emp_code || '',
            name: result.employee.full_name_english || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmployeeError(null);
    setDuplicateError(null);

    // Validate employee exists before saving
    if (!selectedEmployee) {
      setEmployeeError('Please select a valid employee from system.');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!courseName || !board || !institution || !discipline || !year || !result || !educationNature) {
      setEmployeeError('Please fill in all required education details.');
      setLoading(false);
      return;
    }

    try {
      const educationData: CreateEmployeeEducationData = {
        // CSV 4 columns (new standard)
        empNo: empNo,
        acNo: acNo,
        no: no,
        name: empName,
        
        // Employee information
        empCode: empCode,
        empId: empId,
        empName: empName,
        category: category || '',
        company: company || '',
        location: location || '',
        division: division || '',
        department: department || '',
        section: section || '',
        subsection: subsection || '',
        designation: designation || '',
        
        // Education details
        courseName,
        board,
        institution,
        discipline,
        majorSubject,
        year,
        result,
        educationNature,
      };

      await employeeEducationService.create(educationData);
      router.push('/employee-education');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (msg.includes('already has education')) {
        setDuplicateError(msg);
      } else {
        setEmployeeError('Failed to save: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmpCode('');
    setEmpId('');
    setEmpName('');
    setEmpNo('');
    setAcNo('');
    setNo('');
    setCategory('');
    setCompany('');
    setLocation('');
    setDivision('');
    setDepartment('');
    setSection('');
    setSubsection('');
    setDesignation('');
    setCourseName('');
    setBoard('');
    setInstitution('');
    setDiscipline('');
    setMajorSubject('');
    setYear('');
    setResult('');
    setEducationNature('');
    setSelectedEmployee(null);
    setEmployeeError(null);
    setDuplicateError(null);
  };

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Add Employee Education</h4>
          <p className="text-muted mb-0 small">Create new education record</p>
        </div>
        <Link href="/employee-education" className="btn btn-outline-secondary">
          <i className="fas fa-arrow-left me-2"></i> Back to List
        </Link>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-user me-2"></i>Employee Details
          </h5>
          <div className="row g-3">
            <div className="col-md-6">
              <EmployeeSearch
                label="Search Employee *"
                value={empCode}
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
            <div className="col-md-3">
              <label className="form-label fw-medium">Emp No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={empNo}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">AC-No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={acNo}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={no}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Name</label>
              <input
                type="text"
                className="form-control"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Company</label>
              <select
                className="form-select"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Select Company</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Location</label>
              <select
                className="form-select"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Division</label>
              <select
                className="form-select"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                <option value="">Select Division</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Department</label>
              <select
                className="form-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Section</label>
              <select
                className="form-select"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">Select Section</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Subsection</label>
              <select
                className="form-select"
                value={subsection}
                onChange={(e) => setSubsection(e.target.value)}
              >
                <option value="">Select Subsection</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Designation</label>
              <select
                className="form-select"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              >
                <option value="">Select Designation</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-graduation-cap me-2"></i>Education Details
          </h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-medium">Course Name *</label>
              <input
                type="text"
                className="form-control"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Bachelor of Science"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Board/University *</label>
              <input
                type="text"
                className="form-control"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                placeholder="e.g., Dhaka University"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Institution *</label>
              <input
                type="text"
                className="form-control"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g., Dhaka University"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Discipline *</label>
              <input
                type="text"
                className="form-control"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="e.g., Computer Science"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Major Subject</label>
              <input
                type="text"
                className="form-control"
                value={majorSubject}
                onChange={(e) => setMajorSubject(e.target.value)}
                placeholder="e.g., Software Engineering"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Year *</label>
              <input
                type="text"
                className="form-control"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2020"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Result *</label>
              <select
                className="form-select"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                required
              >
                <option value="">Select Result</option>
                {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Education Nature *</label>
              <select
                className="form-select"
                value={educationNature}
                onChange={(e) => setEducationNature(e.target.value)}
                required
              >
                <option value="">Select Nature</option>
                {EDUCATION_NATURES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex gap-2">
            <button 
              type="submit" 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Education Record'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <i className="fas fa-redo me-1"></i> Reset
            </button>
            <Link href="/employee-education" className="btn btn-outline-secondary">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
