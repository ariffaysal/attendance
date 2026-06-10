import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Transform frontend form data to backend format
// Uses only 2 columns: acNo, name
function transformToBackend(data: any) {
  const policies = data.policies || {};
  
  console.log('DEBUG: Transforming data:', JSON.stringify(data, null, 2));
  console.log('DEBUG: Policies object:', JSON.stringify(policies, null, 2));
  
  const result = {
    // 2 columns - use the exact values from the form (populated from selected employee)
    acNo: data.empCode || data.acNo || '',
    name: data.empName || data.name || '',
    category: data.category,
    company: data.company,
    location: data.location,
    division: data.division,
    department: data.department,
    section: data.section,
    subsection: data.subsection,
    designation: data.designation,
    // Map policies to backend fields - using exact policy names from database
    overtimePolicyRule: policies['Overtime Policy']?.ruleName,
    overtimePolicyDate: policies['Overtime Policy']?.effectiveDate,
    holidayIncentiveRule: policies['Holiday Incentive']?.ruleName,
    holidayIncentiveDate: policies['Holiday Incentive']?.effectiveDate,
    dutyRosterPolicyRule: policies['Duty Roster Policy']?.ruleName,
    dutyRosterPolicyDate: policies['Duty Roster Policy']?.effectiveDate,
    leavePolicyRule: policies['Leave Policy']?.ruleName,
    leavePolicyDate: policies['Leave Policy']?.effectiveDate,
    maternityLeavePolicyRule: policies['Maternity Leave']?.ruleName,
    maternityLeavePolicyDate: policies['Maternity Leave']?.effectiveDate,
    attendanceBonusPolicyRule: policies['Attendance Bonus']?.ruleName,
    attendanceBonusPolicyDate: policies['Attendance Bonus']?.effectiveDate,
    absentDeductionPolicyRule: policies['Absent Deduction']?.ruleName,
    absentDeductionPolicyDate: policies['Absent Deduction']?.effectiveDate,
    lateDeductionPolicyRule: policies['Late Deduction']?.ruleName,
    lateDeductionPolicyDate: policies['Late Deduction']?.effectiveDate,
    bonusPolicyRule: policies['Bonus Policy']?.ruleName,
    bonusPolicyDate: policies['Bonus Policy']?.effectiveDate,
    taxPolicyRule: policies['Tax Policy']?.ruleName,
    taxPolicyDate: policies['Tax Policy']?.effectiveDate,
    shiftPolicyRule: policies['Shift Policy']?.ruleName,
    shiftPolicyDate: policies['Shift Policy']?.effectiveDate,
    tiffinBillPolicyRule: policies['Tiffin Bill Policy']?.ruleName,
    tiffinBillPolicyDate: policies['Tiffin Bill Policy']?.effectiveDate,
    allowancePolicyRule: policies['Allowance Policy']?.ruleName,
    allowancePolicyDate: policies['Allowance Policy']?.effectiveDate,
    earlyOutDeductionPolicyRule: policies['Early Out Deduction']?.ruleName,
    earlyOutDeductionPolicyDate: policies['Early Out Deduction']?.effectiveDate,
    serviceBenefitPolicyRule: policies['Service Benefit']?.ruleName,
    serviceBenefitPolicyDate: policies['Service Benefit']?.effectiveDate,
    hdDeductRulePolicyRule: policies['Half Day Deduction']?.ruleName,
    hdDeductRulePolicyDate: policies['Half Day Deduction']?.effectiveDate,
  };
  
  console.log('DEBUG: Transformed result:', JSON.stringify(result, null, 2));
  return result;
}

export const employeePolicyTaggingService = {
  async getAll(search?: string): Promise<any[]> {
    const params = search ? { search } : {};
    const response = await axios.get(`${API_URL}/employee-policy-tagging`, { params });
    return response.data;
  },

  async getById(id: number): Promise<any> {
    const response = await axios.get(`${API_URL}/employee-policy-tagging/${id}`);
    return response.data;
  },

  async getByACNo(acNo: string): Promise<any> {
    const response = await axios.get(`${API_URL}/employee-policy-tagging/by-acno/${acNo}`);
    return response.data;
  },

  async getByEmpCode(empCode: string): Promise<any> {
    const response = await axios.get(`${API_URL}/employee-policy-tagging/by-empcode/${empCode}`);
    return response.data;
  },

  async create(data: any): Promise<any> {
    const backendData = transformToBackend(data);
    const response = await axios.post(`${API_URL}/employee-policy-tagging`, backendData);
    return response.data;
  },

  async update(id: number, data: any): Promise<any> {
    // For updates, only send editable fields (policies, category, company, etc.)
    // Don't send employee identity fields (acNo, name) to prevent overwriting
    const policies = data.policies || {};
    const backendData = {
      category: data.category,
      company: data.company,
      location: data.location,
      division: data.division,
      department: data.department,
      section: data.section,
      subsection: data.subsection,
      designation: data.designation,
      // Map policies to backend fields (only those that exist in actual database schema)
      overtimePolicyRule: policies['Overtime Policy']?.ruleName,
      absentDeductionPolicyRule: policies['Absent Deduction Policy']?.ruleName,
      lateDeductionPolicyRule: policies['Late Deduction Policy']?.ruleName,
      shiftPolicyRule: policies['Shift Policy']?.ruleName,
    };
    const response = await axios.put(`${API_URL}/employee-policy-tagging/${id}`, backendData);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await axios.delete(`${API_URL}/employee-policy-tagging/${id}`);
  },
};
