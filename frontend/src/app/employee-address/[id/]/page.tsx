'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EmployeeAddress } from '@/types/employee-address';
import { employeeAddressService } from '@/services/employee-address.service';

// Dropdown options (same as employee form)
const CATEGORIES = ['Top Management', 'Management', 'Executive', 'Non-Management', 'Contractual', 'Staff'];
const COMPANIES = ['Skyview Online Ltd.', 'Greenmax Technologies Ltd.'];
const LOCATIONS = ['Head Office', 'Corporate Office', 'Branch Office'];
const DEPARTMENTS = ['Accounts & Billing', 'NOC', 'Sales & Marketing', 'Transmission', 'Legal', 'Call Center & Support', 'Maintenance', 'General Administration'];
const DIVISIONS_GEO = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'];

export default function EmployeeAddressFormPage() {
  const router = useRouter();
  const params = useParams();
  const isEdit = params.id && params.id !== 'new';
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sameAsPresent, setSameAsPresent] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EmployeeAddress>({
    mode: 'onChange',
    defaultValues: {
      isSameAsPresent: false,
    }
  });

  // Watch present address fields for auto-fill when checkbox is checked
  const presentValues = watch([
    'presentVillageArea', 'presentHouseNo', 'presentRoadNo', 'presentPostOfficeCode',
    'presentThana', 'presentDistrict', 'presentDivisionGeo', 'presentLandPhone',
    'presentCellPhone', 'presentEmail'
  ]);

  // Auto-fill permanent address when checkbox is checked
  useEffect(() => {
    if (sameAsPresent) {
      setValue('permanentVillageArea', presentValues[0] || '');
      setValue('permanentHouseNo', presentValues[1] || '');
      setValue('permanentRoadNo', presentValues[2] || '');
      setValue('permanentPostOfficeCode', presentValues[3] || '');
      setValue('permanentThana', presentValues[4] || '');
      setValue('permanentDistrict', presentValues[5] || '');
      setValue('permanentDivisionGeo', presentValues[6] || '');
      setValue('permanentLandPhone', presentValues[7] || '');
      setValue('permanentCellPhone', presentValues[8] || '');
      setValue('permanentEmail', presentValues[9] || '');
    }
  }, [sameAsPresent, presentValues, setValue]);

  useEffect(() => {
    if (isEdit) {
      loadEmployeeAddress();
    }
  }, []);

  async function loadEmployeeAddress() {
    try {
      const data = await employeeAddressService.getById(Number(params.id));
      reset(data);
      setSameAsPresent(data.isSameAsPresent || false);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load employee address:', error);
      setError('Failed to load employee address data');
      setLoading(false);
    }
  }

  const onSubmit = async (data: EmployeeAddress, event?: any) => {
    if (event) {
      event.preventDefault();
    }

    setError(null);
    setSuccess(null);
    setSaving(true);

    // Client-side validation for required fields
    const requiredFields = [
      'empCode', 'category', 'company', 'location', 'divisionOrg',
      'department', 'designation', 'presentVillageArea', 'presentThana',
      'presentDistrict', 'presentDivisionGeo'
    ];

    for (const field of requiredFields) {
      const value = data[field as keyof EmployeeAddress];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        setError(`${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`);
        setSaving(false);
        return;
      }
    }

    try {
      let result;
      if (isEdit) {
        result = await employeeAddressService.update(Number(params.id), data);
        setSuccess('Employee address updated successfully! Redirecting...');
      } else {
        result = await employeeAddressService.create(data);
        setSuccess('Employee address created successfully! Redirecting...');
      }
      
      setTimeout(() => {
        router.push('/employee-address');
      }, 1500);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
      setError('Failed to save: ' + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5">Loading...</div>;
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <h4 className="mb-0 fw-bold">
          {isEdit ? 'Edit Employee Address' : 'Add Employee Address'}
        </h4>
      </div>

      <div className="card">
        <div className="card-body">
          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <i className="fas fa-exclamation-circle me-2"></i>
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
            </div>
          )}
          {success && (
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <i className="fas fa-check-circle me-2"></i>
              {success}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Section 1: Employee Identification */}
            <div className="mb-4">
              <h5 className="border-bottom pb-2 mb-3 text-primary">Employee Identification</h5>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Emp Code *</label>
                  <input 
                    {...register('empCode', { required: true })} 
                    className={`form-control ${errors.empCode ? 'is-invalid' : ''}`} 
                  />
                  {errors.empCode && <div className="invalid-feedback">Emp Code is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Category *</label>
                  <select 
                    {...register('category', { required: true })} 
                    className={`form-select ${errors.category ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.category && <div className="invalid-feedback">Category is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Company *</label>
                  <select 
                    {...register('company', { required: true })} 
                    className={`form-select ${errors.company ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.company && <div className="invalid-feedback">Company is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Location *</label>
                  <select 
                    {...register('location', { required: true })} 
                    className={`form-select ${errors.location ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {errors.location && <div className="invalid-feedback">Location is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Division (Org) *</label>
                  <select 
                    {...register('divisionOrg', { required: true })} 
                    className={`form-select ${errors.divisionOrg ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.divisionOrg && <div className="invalid-feedback">Division is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Department *</label>
                  <select 
                    {...register('department', { required: true })} 
                    className={`form-select ${errors.department ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <div className="invalid-feedback">Department is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Section</label>
                  <select {...register('section')} className="form-select">
                    <option value="">Select</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Subsection</label>
                  <select {...register('subsection')} className="form-select">
                    <option value="">Select</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Designation *</label>
                  <input 
                    {...register('designation', { required: true })} 
                    className={`form-control ${errors.designation ? 'is-invalid' : ''}`} 
                  />
                  {errors.designation && <div className="invalid-feedback">Designation is required</div>}
                </div>
              </div>
            </div>

            {/* Section 2: Present Address */}
            <div className="mb-4">
              <h5 className="border-bottom pb-2 mb-3 text-primary">Present Address</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Village/Area *</label>
                  <input 
                    {...register('presentVillageArea', { required: true })} 
                    className={`form-control ${errors.presentVillageArea ? 'is-invalid' : ''}`} 
                  />
                  {errors.presentVillageArea && <div className="invalid-feedback">Village/Area is required</div>}
                </div>
                <div className="col-md-4">
                  <label className="form-label">House No</label>
                  <input {...register('presentHouseNo')} className="form-control" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Road No</label>
                  <input {...register('presentRoadNo')} className="form-control" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Post Office Code</label>
                  <input {...register('presentPostOfficeCode')} className="form-control" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Thana *</label>
                  <input 
                    {...register('presentThana', { required: true })} 
                    className={`form-control ${errors.presentThana ? 'is-invalid' : ''}`} 
                  />
                  {errors.presentThana && <div className="invalid-feedback">Thana is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">District *</label>
                  <input 
                    {...register('presentDistrict', { required: true })} 
                    className={`form-control ${errors.presentDistrict ? 'is-invalid' : ''}`} 
                  />
                  {errors.presentDistrict && <div className="invalid-feedback">District is required</div>}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Division (Geographic) *</label>
                  <select 
                    {...register('presentDivisionGeo', { required: true })} 
                    className={`form-select ${errors.presentDivisionGeo ? 'is-invalid' : ''}`}
                  >
                    <option value="">Select</option>
                    {DIVISIONS_GEO.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.presentDivisionGeo && <div className="invalid-feedback">Division is required</div>}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Land Phone</label>
                  <input {...register('presentLandPhone')} className="form-control" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Cell Phone</label>
                  <input {...register('presentCellPhone')} className="form-control" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email</label>
                  <input type="email" {...register('presentEmail')} className="form-control" />
                </div>
              </div>
            </div>

            {/* Section 3: Permanent Address */}
            <div className="mb-4">
              <h5 className="border-bottom pb-2 mb-3 text-primary">Permanent Address</h5>
              <div className="mb-3">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="sameAsPresent"
                    checked={sameAsPresent}
                    onChange={(e) => setSameAsPresent(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="sameAsPresent">
                    Same as Present Address
                  </label>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Village/Area</label>
                  <input 
                    {...register('permanentVillageArea')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">House No</label>
                  <input 
                    {...register('permanentHouseNo')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Road No</label>
                  <input 
                    {...register('permanentRoadNo')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Post Office Code</label>
                  <input 
                    {...register('permanentPostOfficeCode')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Thana</label>
                  <input 
                    {...register('permanentThana')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">District</label>
                  <input 
                    {...register('permanentDistrict')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Division (Geographic)</label>
                  <select 
                    {...register('permanentDivisionGeo')} 
                    className="form-select"
                    disabled={sameAsPresent}
                  >
                    <option value="">Select</option>
                    {DIVISIONS_GEO.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Land Phone</label>
                  <input 
                    {...register('permanentLandPhone')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Cell Phone</label>
                  <input 
                    {...register('permanentCellPhone')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email</label>
                  <input 
                    type="email" 
                    {...register('permanentEmail')} 
                    className="form-control" 
                    readOnly={sameAsPresent}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : isEdit ? 'Update Address' : 'Save Address'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => router.push('/employee-address')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
