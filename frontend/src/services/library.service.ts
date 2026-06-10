import { api } from './api';

// ==========================================
// INTERFACES
// ==========================================

export interface Policy {
  id: number;
  policy_code: string;
  policy_name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  is_template?: boolean;
  version?: number;
  rule_count?: number;
  rules?: PolicyRule[];
  created_at?: string;
  updated_at?: string;
}

export interface PolicyRule {
  id: number;
  policy_id: number;
  rule_code: string;
  rule_name: string;
  description?: string;
  conditions?: RuleConditions;
  calculation_formula?: string;
  is_active: boolean;
  priority?: number;
  rule_type?: 'standard' | 'exception' | 'override';
  condition_logic?: 'AND' | 'OR';
  created_at?: string;
  updated_at?: string;
}

export interface RuleConditions {
  logic: 'AND' | 'OR';
  conditions: Condition[];
}

export interface Condition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
  value2?: any;
}

export interface PolicyAssignment {
  id: number;
  emp_code: string;
  emp_name?: string;
  department?: string;
  designation?: string;
  policy_id: number;
  policy_code: string;
  policy_name: string;
  policy_category?: string;
  rule_id: number;
  rule_code: string;
  rule_name: string;
  assigned_date: string;
  effective_date?: string;
  expiry_date?: string;
  is_active: boolean;
  is_override: boolean;
  notes?: string;
  status?: 'Active' | 'Pending' | 'Expired';
  created_at?: string;
}

export interface PolicyImpact {
  policy_id: number;
  total_affected_employees: number;
  by_department: { department: string; count: number }[];
  by_rule: { rule_code: string; rule_name: string; count: number }[];
}

export interface RuleEvaluationResult {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  matched: boolean;
  matched_conditions: string[];
  failed_conditions: string[];
  calculated_value?: number;
  execution_time_ms: number;
  errors: string[];
}

export interface AvailableField {
  field: string;
  type: string;
  description: string;
}

export interface AvailableOperator {
  operator: string;
  label: string;
  description: string;
  valueType: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ==========================================
// SERVICE
// ==========================================

export const libraryService = {
  // ==========================================
  // POLICIES
  // ==========================================

  getAllPolicies: async (params?: {
    search?: string;
    category?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Policy>> => {
    const response = await api.get('/library/policies', { params });
    return response.data;
  },

  getPolicyCategories: async (): Promise<{ category: string; count: number }[]> => {
    const response = await api.get('/library/policies/categories');
    return response.data;
  },

  getPolicyById: async (id: number): Promise<Policy> => {
    const response = await api.get(`/library/policies/${id}`);
    return response.data;
  },

  getPolicyImpact: async (id: number): Promise<PolicyImpact> => {
    const response = await api.get(`/library/policies/${id}/impact`);
    return response.data;
  },

  createPolicy: async (data: Partial<Policy>): Promise<Policy> => {
    const response = await api.post('/library/policies', data);
    return response.data;
  },

  updatePolicy: async (id: number, data: Partial<Policy>): Promise<Policy> => {
    const response = await api.put(`/library/policies/${id}`, data);
    return response.data;
  },

  duplicatePolicy: async (id: number): Promise<{ id: number; message: string }> => {
    const response = await api.post(`/library/policies/${id}/duplicate`);
    return response.data;
  },

  deletePolicy: async (id: number): Promise<void> => {
    await api.delete(`/library/policies/${id}`);
  },

  // ==========================================
  // POLICY RULES
  // ==========================================

  getRulesByPolicy: async (policyId: number): Promise<PolicyRule[]> => {
    const response = await api.get(`/library/policies/${policyId}/rules`);
    return response.data;
  },

  createRule: async (policyId: number, data: Partial<PolicyRule>): Promise<PolicyRule> => {
    const response = await api.post(`/library/policies/${policyId}/rules`, data);
    return response.data;
  },

  updateRule: async (ruleId: number, data: Partial<PolicyRule>): Promise<PolicyRule> => {
    const response = await api.put(`/library/rules/${ruleId}`, data);
    return response.data;
  },

  deleteRule: async (ruleId: number): Promise<void> => {
    await api.delete(`/library/rules/${ruleId}`);
  },

  // ==========================================
  // RULE ENGINE - CONDITION EVALUATION
  // ==========================================

  getRuleEngineMetadata: async (): Promise<{ fields: AvailableField[]; operators: AvailableOperator[] }> => {
    const response = await api.get('/library/rule-engine/fields');
    return response.data;
  },

  evaluateRule: async (ruleId: number, employeeContext: Record<string, any>): Promise<RuleEvaluationResult> => {
    const response = await api.post('/library/rules/evaluate', {
      rule_id: ruleId,
      employee_context: employeeContext,
    });
    return response.data;
  },

  evaluatePolicyRules: async (policyId: number, employeeContext: Record<string, any>): Promise<{
    policy_id: number;
    total_rules: number;
    matched_rules: number;
    results: RuleEvaluationResult[];
  }> => {
    const response = await api.post(`/library/policies/${policyId}/evaluate-rules`, {
      employee_context: employeeContext,
    });
    return response.data;
  },

  testRule: async (ruleId: number, testData: Record<string, any>, testName?: string): Promise<RuleEvaluationResult & { test_saved: boolean }> => {
    const response = await api.post(`/library/rules/${ruleId}/test`, {
      test_data: testData,
      test_name: testName,
    });
    return response.data;
  },

  validateConditions: async (conditions: RuleConditions): Promise<{ valid: boolean; errors: string[] }> => {
    const response = await api.post('/library/rules/validate-conditions', { conditions });
    return response.data;
  },

  // ==========================================
  // POLICY ASSIGNMENTS (Dynamic)
  // ==========================================

  getPolicyAssignments: async (params?: {
    emp_code?: string;
    policy_id?: number;
    department?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PolicyAssignment>> => {
    const response = await api.get('/library/assignments', { params });
    return response.data;
  },

  getEmployeePolicies: async (empCode: string): Promise<{ emp_code: string; policies: PolicyAssignment[]; total: number }> => {
    const response = await api.get(`/library/employees/${empCode}/policies`);
    return response.data;
  },

  createAssignment: async (data: Partial<PolicyAssignment>): Promise<{ id: number; message: string }> => {
    const response = await api.post('/library/assignments', data);
    return response.data;
  },

  updateAssignment: async (id: number, data: Partial<PolicyAssignment>): Promise<{ id: number; message: string }> => {
    const response = await api.put(`/library/assignments/${id}`, data);
    return response.data;
  },

  deleteAssignment: async (id: number): Promise<void> => {
    await api.delete(`/library/assignments/${id}`);
  },

  bulkAssign: async (data: {
    policy_id: number;
    rule_id: number;
    filter_criteria: {
      departments?: string[];
      designations?: string[];
      categories?: string[];
      emp_codes?: string[];
    };
    effective_date?: string;
    notes?: string;
  }): Promise<{
    total_affected: number;
    successful: number;
    failed: number;
    failed_employees?: string[];
    message: string;
  }> => {
    const response = await api.post('/library/assignments/bulk', data);
    return response.data;
  },

  copyAssignments: async (fromEmpCode: string, toEmpCodes: string[]): Promise<{
    copied_from: string;
    total_target_employees: number;
    successful: number;
    failed: number;
    assignments_copied: number;
    message: string;
  }> => {
    const response = await api.post('/library/assignments/copy', {
      from_emp_code: fromEmpCode,
      to_emp_codes: toEmpCodes,
    });
    return response.data;
  },

  // ==========================================
  // POLICY TEMPLATES
  // ==========================================

  getPolicyTemplates: async (): Promise<Policy[]> => {
    const response = await api.get('/library/templates');
    return response.data;
  },

  createPolicyFromTemplate: async (templateId: number, newCode: string, newName: string): Promise<{ id: number; message: string }> => {
    const response = await api.post(`/library/policies/${templateId}/create-from-template`, {
      policy_code: newCode,
      policy_name: newName,
    });
    return response.data;
  },

  // Get all active policies with their rules (for policy tagging dropdown)
  getActivePoliciesWithRules: async (): Promise<Policy[]> => {
    const response = await api.get('/library/policies/active-with-rules');
    return response.data;
  },
};
