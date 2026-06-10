import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';

export interface Condition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
  value2?: any; // For between operator
}

export interface RuleConditions {
  logic: 'AND' | 'OR';
  conditions: Condition[];
}

export interface EmployeeContext {
  emp_code: string;
  emp_id?: string;
  department?: string;
  designation?: string;
  category?: string;
  company?: string;
  location?: string;
  joining_date?: string;
  years_of_service?: number;
  basic_salary?: number;
  gross_salary?: number;
  [key: string]: any;
}

export interface EvaluationResult {
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

@Injectable()
export class RuleEngineService {
  constructor(
    @Inject(SQL_CONNECTION) private readonly db: mysql.Connection,
  ) {}

  /**
   * Evaluate a single rule against employee context
   */
  async evaluateRule(
    ruleId: number,
    context: EmployeeContext,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    const result: EvaluationResult = {
      rule_id: ruleId,
      rule_code: '',
      rule_name: '',
      matched: false,
      matched_conditions: [],
      failed_conditions: [],
      execution_time_ms: 0,
      errors: [],
    };

    try {
      // Fetch rule from database
      const [rows] = await this.db.execute(
        'SELECT * FROM library_policy_rules WHERE id = ?',
        [ruleId],
      );
      const rules = rows as any[];

      if (rules.length === 0) {
        result.errors.push(`Rule with ID ${ruleId} not found`);
        result.execution_time_ms = Date.now() - startTime;
        return result;
      }

      const rule = rules[0];
      result.rule_code = rule.rule_code;
      result.rule_name = rule.rule_name;

      // Parse conditions
      let conditions: RuleConditions | null = null;
      if (rule.conditions) {
        try {
          conditions = typeof rule.conditions === 'string' 
            ? JSON.parse(rule.conditions) 
            : rule.conditions;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          result.errors.push(`Failed to parse conditions: ${errorMessage}`);
        }
      }

      // Evaluate conditions
      if (conditions && conditions.conditions && conditions.conditions.length > 0) {
        const logic = conditions.logic || 'AND';
        const conditionResults: boolean[] = [];

        for (const condition of conditions.conditions) {
          const matches = this.evaluateCondition(condition, context);
          conditionResults.push(matches);

          const conditionDesc = `${condition.field} ${condition.operator} ${condition.value}`;
          if (matches) {
            result.matched_conditions.push(conditionDesc);
          } else {
            result.failed_conditions.push(conditionDesc);
          }
        }

        // Apply logic (AND/OR)
        if (logic === 'AND') {
          result.matched = conditionResults.every(r => r);
        } else {
          result.matched = conditionResults.some(r => r);
        }
      } else {
        // No conditions means the rule always matches
        result.matched = true;
      }

      // Calculate value if rule matched and has formula
      if (result.matched && rule.calculation_formula) {
        result.calculated_value = this.calculateValue(
          rule.calculation_formula,
          context,
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Evaluation error: ${errorMessage}`);
    }

    result.execution_time_ms = Date.now() - startTime;
    return result;
  }

  /**
   * Evaluate all rules for a policy against employee context
   */
  async evaluatePolicyRules(
    policyId: number,
    context: EmployeeContext,
  ): Promise<EvaluationResult[]> {
    const [rows] = await this.db.execute(
      `SELECT id FROM library_policy_rules 
       WHERE policy_id = ? AND is_active = true 
       ORDER BY priority ASC, id ASC`,
      [policyId],
    );
    const rules = rows as any[];

    const results: EvaluationResult[] = [];
    for (const rule of rules) {
      const result = await this.evaluateRule(rule.id, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Find the best matching rule for a policy
   */
  async findBestMatchingRule(
    policyId: number,
    context: EmployeeContext,
  ): Promise<EvaluationResult | null> {
    const results = await this.evaluatePolicyRules(policyId, context);
    
    // Filter matched rules and sort by priority (assuming we have priority in the database)
    const matchedRules = results.filter(r => r.matched);
    
    if (matchedRules.length === 0) {
      return null;
    }

    // Return the first matching rule (highest priority due to ORDER BY)
    return matchedRules[0];
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: Condition, context: EmployeeContext): boolean {
    const fieldValue = context[condition.field];
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return fieldValue == compareValue;
      
      case 'ne':
        return fieldValue != compareValue;
      
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      
      case 'in':
        if (Array.isArray(compareValue)) {
          return compareValue.includes(fieldValue);
        }
        return String(fieldValue).split(',').map(s => s.trim()).includes(String(compareValue));
      
      case 'nin':
        if (Array.isArray(compareValue)) {
          return !compareValue.includes(fieldValue);
        }
        return !String(fieldValue).split(',').map(s => s.trim()).includes(String(compareValue));
      
      case 'between':
        const numVal = Number(fieldValue);
        return numVal >= Number(compareValue) && numVal <= Number(condition.value2);
      
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
      
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(compareValue).toLowerCase());
      
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(compareValue).toLowerCase());
      
      default:
        return false;
    }
  }

  /**
   * Calculate value using formula
   */
  private calculateValue(formula: string, context: EmployeeContext): number | undefined {
    try {
      // Replace context variables in formula
      let processedFormula = formula;
      
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'number') {
          processedFormula = processedFormula.replace(
            new RegExp(`\\b${key}\\b`, 'g'),
            String(value),
          );
        }
      }

      // Handle common functions
      processedFormula = processedFormula
        .replace(/\bbasic_salary\b/g, String(context.basic_salary || 0))
        .replace(/\bgross_salary\b/g, String(context.gross_salary || 0))
        .replace(/\byears_of_service\b/g, String(context.years_of_service || 0));

      // Security: Only allow safe mathematical expressions
      // Remove any potentially dangerous characters
      const safeFormula = processedFormula.replace(/[^0-9+\-*/().\s]/g, '');
      
      if (safeFormula.length === 0) {
        return undefined;
      }

      // Evaluate using Function constructor (safer than eval)
      const result = new Function('return ' + safeFormula)();
      
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100; // Round to 2 decimal places
      }
      
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Test a rule with provided test data
   */
  async testRule(
    ruleId: number,
    testData: EmployeeContext,
    saveTestCase: boolean = false,
    testName?: string,
  ): Promise<EvaluationResult & { test_saved: boolean }> {
    const result = await this.evaluateRule(ruleId, testData);
    let testSaved = false;

    if (saveTestCase && testName) {
      try {
        await this.db.execute(
          `INSERT INTO library_rule_tests 
           (rule_id, test_name, test_data, expected_result, actual_result, test_passed, test_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ruleId,
            testName,
            JSON.stringify(testData),
            true, // Assuming expected result is true for now
            result.matched,
            result.matched, // Test passes if rule matches
            `Auto-generated test: ${result.matched ? 'PASSED' : 'FAILED'}`,
          ],
        );
        testSaved = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to save test case: ${errorMessage}`);
      }
    }

    return { ...result, test_saved: testSaved };
  }

  /**
   * Validate conditions JSON structure
   */
  validateConditions(conditions: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!conditions) {
      return { valid: true, errors };
    }

    if (typeof conditions !== 'object') {
      return { valid: false, errors: ['Conditions must be an object'] };
    }

    if (!conditions.conditions || !Array.isArray(conditions.conditions)) {
      errors.push('conditions.conditions must be an array');
    } else {
      for (let i = 0; i < conditions.conditions.length; i++) {
        const condition = conditions.conditions[i];
        
        if (!condition.field) {
          errors.push(`Condition ${i + 1}: field is required`);
        }
        
        if (!condition.operator) {
          errors.push(`Condition ${i + 1}: operator is required`);
        }
        
        const validOperators = [
          'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 
          'in', 'nin', 'between', 'contains', 'starts_with', 'ends_with'
        ];
        if (condition.operator && !validOperators.includes(condition.operator)) {
          errors.push(`Condition ${i + 1}: invalid operator '${condition.operator}'`);
        }

        if (condition.operator === 'between' && condition.value2 === undefined) {
          errors.push(`Condition ${i + 1}: value2 is required for 'between' operator`);
        }
      }
    }

    if (conditions.logic && !['AND', 'OR'].includes(conditions.logic)) {
      errors.push("logic must be 'AND' or 'OR'");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get available fields for conditions (from employee data)
   */
  getAvailableFields(): { field: string; type: string; description: string }[] {
    return [
      { field: 'emp_code', type: 'string', description: 'Employee Code' },
      { field: 'emp_id', type: 'string', description: 'Employee ID' },
      { field: 'department', type: 'string', description: 'Department Name' },
      { field: 'designation', type: 'string', description: 'Designation' },
      { field: 'category', type: 'string', description: 'Employee Category' },
      { field: 'company', type: 'string', description: 'Company Name' },
      { field: 'location', type: 'string', description: 'Work Location' },
      { field: 'years_of_service', type: 'number', description: 'Years of Service' },
      { field: 'basic_salary', type: 'number', description: 'Basic Salary' },
      { field: 'gross_salary', type: 'number', description: 'Gross Salary' },
      { field: 'joining_date', type: 'date', description: 'Date of Joining' },
    ];
  }

  /**
   * Get available operators
   */
  getAvailableOperators(): { operator: string; label: string; description: string; valueType: string }[] {
    return [
      { operator: 'eq', label: 'Equals', description: 'Equal to value', valueType: 'any' },
      { operator: 'ne', label: 'Not Equals', description: 'Not equal to value', valueType: 'any' },
      { operator: 'gt', label: 'Greater Than', description: 'Greater than value', valueType: 'number' },
      { operator: 'gte', label: 'Greater Than or Equal', description: 'Greater than or equal to value', valueType: 'number' },
      { operator: 'lt', label: 'Less Than', description: 'Less than value', valueType: 'number' },
      { operator: 'lte', label: 'Less Than or Equal', description: 'Less than or equal to value', valueType: 'number' },
      { operator: 'in', label: 'In List', description: 'Value is in the list', valueType: 'array' },
      { operator: 'nin', label: 'Not In List', description: 'Value is not in the list', valueType: 'array' },
      { operator: 'between', label: 'Between', description: 'Value is between two numbers', valueType: 'range' },
      { operator: 'contains', label: 'Contains', description: 'String contains value', valueType: 'string' },
      { operator: 'starts_with', label: 'Starts With', description: 'String starts with value', valueType: 'string' },
      { operator: 'ends_with', label: 'Ends With', description: 'String ends with value', valueType: 'string' },
    ];
  }
}
