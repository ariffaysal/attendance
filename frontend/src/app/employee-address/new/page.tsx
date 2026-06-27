'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { employeeAddressService } from '@/services/employee-address.service';
import { employeeService, EmployeeSuggestion } from '@/services/employee.service';
import EmployeeSearch from '@/components/EmployeeSearch';

// Dropdown options
const CATEGORIES = ['Top Management', 'Management', 'Executive', 'Non-Management', 'Contractual', 'Staff'];
const COMPANIES = ['Skyview Online Ltd.', 'Greenmax Technologies Ltd.'];
const LOCATIONS = ['Head Office', 'Corporate Office', 'Branch Office'];
const DEPARTMENTS = ['Accounts & Billing', 'NOC', 'Sales & Marketing', 'Transmission', 'Legal', 'Call Center & Support', 'Maintenance', 'General Administration'];
const DIVISIONS = ['Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'];

interface AddressFormData {
  // CSV 4 identity columns
  empNo: string;
  acNo: string;
  no: string;
  name: string;
  
  // Employee Identification (legacy)
  empCode: string;
  empId: string;
  empName: string;
  
  // Employee Info
  category: string;
  company: string;
  location: string;
  divisionOrg: string;
  department: string;
  section: string;
  subsection: string;
  designation: string;
  
  // Present Address
  presentVillageArea: string;
  presentHouseNo: string;
  presentRoadNo: string;
  presentPostOfficeCode: string;
  presentThana: string;
  presentDistrict: string;
  presentDivisionGeo: string;
  presentLandPhone: string;
  presentCellPhone: string;
  presentEmail: string;
  
  // Permanent Address
  isSameAsPresent: boolean;
  permanentVillageArea: string;
  permanentHouseNo: string;
  permanentRoadNo: string;
  permanentPostOfficeCode: string;
  permanentThana: string;
  permanentDistrict: string;
  permanentDivisionGeo: string;
  permanentLandPhone: string;
  permanentCellPhone: string;
  permanentEmail: string;
}

export default function NewAddressPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSuggestion | null>(null);
  const [validatingEmployee, setValidatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'name' | 'acc_no'>('name');

  // Individual state variables for identity fields (like salary-information)
  const [empCode, setEmpCode] = useState('');
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empNo, setEmpNo] = useState('');    // Emp No. field
  const [acNo, setAcNo] = useState('');      // AC-No. field  
  const [no, setNo] = useState('');          // No. field
  const [name, setName] = useState('');        // Name field
  
  // Additional state variables for employee info
  const [category, setCategory] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [divisionOrg, setDivisionOrg] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [subsection, setSubsection] = useState('');
  const [designation, setDesignation] = useState('');
  
  // State variables for present address
  const [presentVillageArea, setPresentVillageArea] = useState('');
  const [presentHouseNo, setPresentHouseNo] = useState('');
  const [presentRoadNo, setPresentRoadNo] = useState('');
  const [presentPostOfficeCode, setPresentPostOfficeCode] = useState('');
  const [presentThana, setPresentThana] = useState('');
  const [presentDistrict, setPresentDistrict] = useState('');
  const [presentDivisionGeo, setPresentDivisionGeo] = useState('');
  const [presentLandPhone, setPresentLandPhone] = useState('');
  const [presentCellPhone, setPresentCellPhone] = useState('');
  const [presentEmail, setPresentEmail] = useState('');
  
  // State variables for permanent address
  const [permanentVillageArea, setPermanentVillageArea] = useState('');
  const [permanentHouseNo, setPermanentHouseNo] = useState('');
  const [permanentRoadNo, setPermanentRoadNo] = useState('');
  const [permanentPostOfficeCode, setPermanentPostOfficeCode] = useState('');
  const [permanentThana, setPermanentThana] = useState('');
  const [permanentDistrict, setPermanentDistrict] = useState('');
  const [permanentDivisionGeo, setPermanentDivisionGeo] = useState('');
  const [permanentLandPhone, setPermanentLandPhone] = useState('');
  const [permanentCellPhone, setPermanentCellPhone] = useState('');
  const [permanentEmail, setPermanentEmail] = useState('');
  const [isSameAsPresent, setIsSameAsPresent] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<AddressFormData>({
    mode: 'onChange',
    defaultValues: {
      // Present Address
      presentVillageArea: presentVillageArea,
      presentHouseNo: presentHouseNo,
      presentRoadNo: presentRoadNo,
      presentPostOfficeCode: presentPostOfficeCode,
      presentThana: presentThana,
      presentDistrict: presentDistrict,
      presentDivisionGeo: presentDivisionGeo,
      presentLandPhone: presentLandPhone,
      presentCellPhone: presentCellPhone,
      presentEmail: presentEmail,
      
      // Permanent Address
      isSameAsPresent: isSameAsPresent,
      permanentVillageArea: permanentVillageArea,
      permanentHouseNo: permanentHouseNo,
      permanentRoadNo: permanentRoadNo,
      permanentPostOfficeCode: permanentPostOfficeCode,
      permanentThana: permanentThana,
      permanentDistrict: permanentDistrict,
      permanentDivisionGeo: permanentDivisionGeo,
      permanentLandPhone: permanentLandPhone, 
      permanentCellPhone: permanentCellPhone,
      permanentEmail: permanentEmail,
    },
  });

  // Watch employee fields for auto-populate
  const isSameAsPresentValue = watch('isSameAsPresent');

  // Handle employee selection from search
  const handleEmployeeSelect = async (employee: EmployeeSuggestion) => {
    setSelectedEmployee(employee);
    setEmployeeError(null);
    setDuplicateError(null);
    
    // Auto-populate all 4 identity fields based on search type
    if (searchType === 'acc_no') {
      // When searching by AC-No., show AC-No. in search field
      setEmpCode(employee.acNo || employee.emp_code);
    } else {
      // When searching by name, show name in search field
      setEmpCode(employee.name || employee.full_name_english);
    }
    
    // Populate all 4 identity fields from employee data
    setEmpNo(employee.empNo || '');           // Emp No.
    setAcNo(employee.acNo || '');             // AC-No.
    setNo(employee.no || '');                 // No.
    const employeeName = employee.name || employee.full_name_english || '';
    setName(employeeName);
    setEmpName(employeeName); // Legacy name field
    setEmpId(employee.empNo || '');           // Emp ID (for compatibility)
    
    // Additional fields
    setCategory(employee.department || '');
    setDesignation(employee.designation || '');
    setCompany(employee.company || '');
    
    // Validate if employee already has address records
    try {
      setValidatingEmployee(true);
      const empKey = employee.emp_code ?? employee.acNo ?? employee.no;
      if (typeof empKey === 'string' && empKey.length > 0) {
        const existing = await employeeAddressService.getByEmpCode(empKey);
        if (existing && existing.id) {
          setDuplicateError(`Employee ${employee.name || employee.full_name_english} (${empKey}) already has address records. You can view and edit existing records.`);
        }
      }
    } catch (err) {
      // Employee doesn't have address records yet - this is what we want
    } finally {
      setValidatingEmployee(false);
    }
  };

  // Handle manual empCode input validation
  const handleEmpCodeChange = async (value: string) => {
    setEmpCode(value || '');
    setValue('empCode', value || '');
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
            empNo: result.employee.emp_id || '',
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

  // Auto-populate permanent address when same as present
  useEffect(() => {
    if (isSameAsPresent) {
      setPermanentVillageArea(watch('presentVillageArea'));
      setPermanentHouseNo(watch('presentHouseNo'));
      setPermanentRoadNo(watch('presentRoadNo'));
      setPermanentPostOfficeCode(watch('presentPostOfficeCode'));
      setPermanentThana(watch('presentThana'));
      setPermanentDistrict(watch('presentDistrict'));
      setPermanentDivisionGeo(watch('presentDivisionGeo'));
      setPermanentLandPhone(watch('presentLandPhone'));
      setPermanentCellPhone(watch('presentCellPhone'));
      setPermanentEmail(watch('presentEmail'));
    }
  }, [isSameAsPresent, watch]);

  const onSubmit = async (data: AddressFormData) => {
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
      await employeeAddressService.create(data);
      setSuccess('Address saved successfully!');
      setTimeout(() => {
        router.push('/employee-address');
      }, 1500);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (msg.includes('already has address')) {
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
          <h4 className="mb-1 fw-bold">Add Employee Address</h4>
          <p className="text-muted mb-0 small">Create new address record</p>
        </div>
        <Link href="/employee-address" className="btn btn-outline-secondary">
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
                  placeholder="Auto-populated"
                  value={name}
                  readOnly
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Category</label>
                <select className="form-select" {...register('category')}>
                  <option value="">Select Category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Company</label>
                <select className="form-select" {...register('company')}>
                  <option value="">Select Company</option>
                  {COMPANIES.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Location</label>
                <select className="form-select" {...register('location')}>
                  <option value="">Select Location</option>
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Division</label>
                <select className="form-select" {...register('divisionOrg')}>
                  <option value="">Select Division</option>
                  {DIVISIONS.map(div => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Department</label>
                <select className="form-select" {...register('department')}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Section</label>
                <input
                  type="text"
                  className="form-control"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="Enter section"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Subsection</label>
                <input
                  type="text"
                  className="form-control"
                  value={subsection}
                  onChange={(e) => setSubsection(e.target.value)}
                  placeholder="Enter subsection"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Enter designation"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-home me-2"></i>Present Address
          </h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-medium">Village/Area</label>
              <input
                type="text"
                className="form-control"
                {...register('presentVillageArea')}
                placeholder="Enter village or area"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">House No.</label>
              <input
                type="text"
                className="form-control"
                {...register('presentHouseNo')}
                placeholder="Enter house number"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Road No.</label>
              <input
                type="text"
                className="form-control"
                {...register('presentRoadNo')}
                placeholder="Enter road number"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Post Office Code</label>
              <input
                type="text"
                className="form-control"
                {...register('presentPostOfficeCode')}
                placeholder="Enter post office code"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Thana</label>
              <input
                type="text"
                className="form-control"
                {...register('presentThana')}
                placeholder="Enter thana"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">District</label>
              <input
                type="text"
                className="form-control"
                {...register('presentDistrict')}
                placeholder="Enter district"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Division</label>
              <select className="form-select" {...register('presentDivisionGeo')}>
                <option value="">Select Division</option>
                {DIVISIONS.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Land Phone</label>
              <input
                type="tel"
                className="form-control"
                {...register('presentLandPhone')}
                placeholder="Enter land phone"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Cell Phone</label>
              <input
                type="tel"
                className="form-control"
                {...register('presentCellPhone')}
                placeholder="Enter cell phone"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Email</label>
              <input
                type="email"
                className="form-control"
                {...register('presentEmail')}
                placeholder="Enter email"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-home me-2"></i>Permanent Address
          </h5>
          <div className="row g-3">
            <div className="col-md-12 mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  {...register('isSameAsPresent')}
                />
                <label className="form-check-label fw-medium">
                  Same as Present Address
                </label>
              </div>
            </div>
            {!isSameAsPresent && (
              <>
                <div className="col-md-6">
                  <label className="form-label fw-medium">Village/Area</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentVillageArea')}
                    placeholder="Enter village or area"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">House No.</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentHouseNo')}
                    placeholder="Enter house number"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Road No.</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentRoadNo')}
                    placeholder="Enter road number"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Post Office Code</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentPostOfficeCode')}
                    placeholder="Enter post office code"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Thana</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentThana')}
                    placeholder="Enter thana"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">District</label>
                  <input
                    type="text"
                    className="form-control"
                    {...register('permanentDistrict')}
                    placeholder="Enter district"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Division</label>
                  <select className="form-select" {...register('permanentDivisionGeo')}>
                    <option value="">Select Division</option>
                    {DIVISIONS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Land Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    {...register('permanentLandPhone')}
                    placeholder="Enter land phone"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Cell Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    {...register('permanentCellPhone')}
                    placeholder="Enter cell phone"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-medium">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    {...register('permanentEmail')}
                    placeholder="Enter email"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2">
        <Link href="/employee-address" className="btn btn-outline-secondary">
          <i className="fas fa-times me-2"></i>Cancel
        </Link>
        <button type="submit" className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? (
            <>
              <i className="fas fa-spinner fa-spin me-2"></i>
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save me-2"></i>
              Save Address
            </>
          )}
        </button>
      </div>
    </div>
  );
}
