import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/create-policy.dto';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';
import { 
  CreatePolicyAssignmentDto, 
  UpdatePolicyAssignmentDto, 
  BulkAssignDto 
} from './dto/policy-assignment.dto';

export interface PolicyFilter {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface AssignmentFilter {
  empCode?: string;
  policyId?: number;
  department?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class LibraryService {
  constructor(@Inject(SQL_CONNECTION) private readonly db: mysql.Connection) {}

  // ==========================================
  // POLICIES - Enhanced
  // ==========================================

  async getAllPolicies(filter?: PolicyFilter) {
    const { search, category, isActive, page = 1, limit = 50 } = filter || {};
    
    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (search) {
      conditions.push(`(p.policy_name LIKE ? OR p.policy_code LIKE ? OR p.category LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (category) {
      conditions.push(`p.category = ?`);
      params.push(category);
    }
    
    if (isActive !== undefined) {
      conditions.push(`p.is_active = ?`);
      params.push(isActive);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count
    const [countRows] = await this.db.execute(
      `SELECT COUNT(*) as total FROM library_policies p ${whereClause}`,
      params,
    );
    const total = (countRows as any[])[0]?.total || 0;
    
    // Get paginated data
    const offset = (page - 1) * limit;
    const [rows] = await this.db.execute(
      `
        SELECT 
          p.*,
          COUNT(r.id) as rule_count
        FROM library_policies p
        LEFT JOIN library_policy_rules r ON p.id = r.policy_id
        ${whereClause}
        GROUP BY p.id 
        ORDER BY p.policy_name
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );
    
    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getPolicyCategories() {
    const [rows] = await this.db.execute(
      `SELECT DISTINCT category, COUNT(*) as count 
       FROM library_policies 
       WHERE category IS NOT NULL 
       GROUP BY category 
       ORDER BY category`
    );
    return rows;
  }

  async getPolicyById(id: number, includeRules: boolean = false) {
    const [rows] = await this.db.execute(
      'SELECT * FROM library_policies WHERE id = ?',
      [id],
    );
    const policies = rows as any[];
    if (policies.length === 0) {
      throw new NotFoundException('Policy not found');
    }
    
    const policy = policies[0];
    
    if (includeRules) {
      const [rules] = await this.db.execute(
        `SELECT * FROM library_policy_rules 
         WHERE policy_id = ? 
         ORDER BY rule_code ASC`,
        [id],
      );
      policy.rules = rules;
    }
    
    return policy;
  }

  async getPolicyImpactAnalysis(policyId: number) {
    // Get total employees with this policy
    const [totalRows] = await this.db.execute(
      `SELECT COUNT(DISTINCT emp_code) as total 
       FROM employee_policy_assignments 
       WHERE policy_id = ? AND is_active = true`,
      [policyId],
    );
    
    // Get breakdown by department
    const [deptRows] = await this.db.execute(
      `SELECT e.department, COUNT(*) as count 
       FROM employee_policy_assignments a
       JOIN employees e ON a.emp_code = e.emp_code
       WHERE a.policy_id = ? AND a.is_active = true
       GROUP BY e.department
       ORDER BY count DESC`,
      [policyId],
    );
    
    // Get breakdown by rule
    const [ruleRows] = await this.db.execute(
      `SELECT r.rule_code, r.rule_name, COUNT(*) as count 
       FROM employee_policy_assignments a
       JOIN library_policy_rules r ON a.rule_id = r.id
       WHERE a.policy_id = ? AND a.is_active = true
       GROUP BY a.rule_id, r.rule_code, r.rule_name
       ORDER BY count DESC`,
      [policyId],
    );
    
    return {
      policy_id: policyId,
      total_affected_employees: (totalRows as any[])[0]?.total || 0,
      by_department: deptRows,
      by_rule: ruleRows,
    };
  }

  async createPolicy(data: CreatePolicyDto) {
    // Check for duplicate policy code
    const [existing] = await this.db.execute(
      'SELECT id FROM library_policies WHERE policy_code = ?',
      [data.policy_code],
    );
    
    if ((existing as any[]).length > 0) {
      throw new BadRequestException(`Policy code '${data.policy_code}' already exists`);
    }
    
    const [result] = await this.db.execute(
      `INSERT INTO library_policies 
       (policy_code, policy_name, description, category, is_active, is_template) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.policy_code,
        data.policy_name,
        data.description || null,
        data.category || null,
        data.is_active !== false,
        data.is_template || false,
      ],
    );
    
    // Create default rules for the policy
    const policyId = (result as any).insertId;
    await this.createDefaultRules(policyId);
    
    return { id: policyId, ...data };
  }

  async duplicatePolicy(id: number) {
    const policy = await this.getPolicyById(id, true);
    
    const newCode = `${policy.policy_code}_COPY_${Date.now()}`;
    const [result] = await this.db.execute(
      `INSERT INTO library_policies 
       (policy_code, policy_name, description, category, is_active, is_template, version) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newCode,
        `${policy.policy_name} (Copy)`,
        policy.description,
        policy.category,
        false, // Inactive by default
        false,
        1,
      ],
    );
    
    const newPolicyId = (result as any).insertId;
    
    // Copy all rules
    if (policy.rules && policy.rules.length > 0) {
      for (const rule of policy.rules) {
        await this.db.execute(
          `INSERT INTO library_policy_rules 
           (policy_id, rule_code, rule_name, description, conditions, calculation_formula, 
            is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newPolicyId,
            rule.rule_code,
            rule.rule_name,
            rule.description,
            rule.conditions,
            rule.calculation_formula,
            rule.is_active,
          ],
        );
      }
    } else {
      await this.createDefaultRules(newPolicyId);
    }
    
    return { 
      id: newPolicyId, 
      message: 'Policy duplicated successfully',
      original_id: id,
    };
  }

  async updatePolicy(id: number, data: UpdatePolicyDto) {
    // Check for duplicate policy code if changing
    if (data.policy_code) {
      const [existing] = await this.db.execute(
        'SELECT id FROM library_policies WHERE policy_code = ? AND id != ?',
        [data.policy_code, id],
      );
      
      if ((existing as any[]).length > 0) {
        throw new BadRequestException(`Policy code '${data.policy_code}' already exists`);
      }
    }
    
    await this.db.execute(
      `UPDATE library_policies 
       SET policy_code = ?, policy_name = ?, description = ?, 
           category = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.policy_code,
        data.policy_name,
        data.description || null,
        data.category || null,
        data.is_active,
        id,
      ],
    );
    return { id, ...data };
  }

  async deletePolicy(id: number) {
    // Check if policy has any active assignments
    const [assignments] = await this.db.execute(
      'SELECT COUNT(*) as count FROM employee_policy_assignments WHERE policy_id = ? AND is_active = true',
      [id],
    );
    
    if ((assignments as any[])[0]?.count > 0) {
      throw new BadRequestException('Cannot delete policy with active employee assignments');
    }
    
    // Rules and assignments will be deleted automatically due to ON DELETE CASCADE
    await this.db.execute(
      'DELETE FROM library_policies WHERE id = ?',
      [id],
    );
    return { success: true };
  }

  // ==========================================
  // POLICY RULES - Enhanced
  // ==========================================

  async getRulesByPolicy(policyId: number) {
    const [rows] = await this.db.execute(
      `SELECT * FROM library_policy_rules 
       WHERE policy_id = ? 
       ORDER BY rule_code ASC`,
      [policyId],
    );
    return rows;
  }

  async createRule(policyId: number, data: CreateRuleDto) {
    // Check for duplicate rule code within policy
    const [existing] = await this.db.execute(
      'SELECT id FROM library_policy_rules WHERE policy_id = ? AND rule_code = ?',
      [policyId, data.rule_code],
    );
    
    if ((existing as any[]).length > 0) {
      throw new BadRequestException(`Rule code '${data.rule_code}' already exists for this policy`);
    }
    
    const [result] = await this.db.execute(
      `INSERT INTO library_policy_rules 
       (policy_id, rule_code, rule_name, description, conditions, calculation_formula, 
        is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        policyId,
        data.rule_code,
        data.rule_name,
        data.description || null,
        data.conditions ? JSON.stringify(data.conditions) : null,
        data.calculation_formula || null,
        data.is_active !== false,
      ],
    );
    return { id: (result as any).insertId, policy_id: policyId, ...data };
  }

  async updateRule(ruleId: number, data: UpdateRuleDto) {
    console.log('[DEBUG] updateRule called:', { ruleId, data });
    
    const [existing] = await this.db.execute(
      'SELECT policy_id FROM library_policy_rules WHERE id = ?',
      [ruleId],
    );
    
    if ((existing as any[]).length === 0) {
      throw new NotFoundException('Rule not found');
    }
    
    // Check for duplicate rule code if changing
    if (data.rule_code) {
      const policyId = (existing as any[])[0].policy_id;
      const [duplicate] = await this.db.execute(
        'SELECT id FROM library_policy_rules WHERE policy_id = ? AND rule_code = ? AND id != ?',
        [policyId, data.rule_code, ruleId],
      );
      
      if ((duplicate as any[]).length > 0) {
        throw new BadRequestException(`Rule code '${data.rule_code}' already exists for this policy`);
      }
    }
    
    // Build dynamic query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (data.rule_code !== undefined) {
      updates.push('rule_code = ?');
      values.push(data.rule_code);
    }
    if (data.rule_name !== undefined) {
      updates.push('rule_name = ?');
      values.push(data.rule_name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }
    if (data.conditions !== undefined) {
      updates.push('conditions = ?');
      values.push(data.conditions ? JSON.stringify(data.conditions) : null);
    }
    if (data.calculation_formula !== undefined) {
      updates.push('calculation_formula = ?');
      values.push(data.calculation_formula || null);
    }

    if (updates.length === 0) {
      return { id: ruleId };
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(ruleId);
    
    await this.db.execute(
      `UPDATE library_policy_rules SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
    return { id: ruleId, ...data };
  }

  async deleteRule(ruleId: number) {
    const [result] = await this.db.execute(
      'DELETE FROM library_policy_rules WHERE id = ?',
      [ruleId],
    );
    
    if ((result as any).affectedRows === 0) {
      throw new NotFoundException('Rule not found');
    }
    
    return { success: true };
  }

  // ==========================================
  // POLICY ASSIGNMENTS (Dynamic)
  // ==========================================

  async getPolicyAssignments(filter: AssignmentFilter) {
    const { empCode, policyId, department, isActive, page = 1, limit = 50 } = filter;
    
    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (empCode) {
      conditions.push('a.emp_code = ?');
      params.push(empCode);
    }
    
    if (policyId !== undefined) {
      conditions.push('a.policy_id = ?');
      params.push(policyId);
    }
    
    if (isActive !== undefined) {
      conditions.push('a.is_active = ?');
      params.push(isActive);
    }
    
    if (department) {
      conditions.push('e.department = ?');
      params.push(department);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count
    const [countRows] = await this.db.execute(
      `SELECT COUNT(*) as total 
       FROM employee_policy_assignments a
       LEFT JOIN employees e ON a.emp_code = e.emp_code
       ${whereClause}`,
      params,
    );
    const total = (countRows as any[])[0]?.total || 0;
    
    // Get paginated data
    const offset = (page - 1) * limit;
    const [rows] = await this.db.execute(
      `
        SELECT 
          a.id,
          a.emp_code,
          e.full_name_english as emp_name,
          e.department,
          e.designation,
          p.id as policy_id,
          p.policy_code,
          p.policy_name,
          p.category as policy_category,
          r.id as rule_id,
          r.rule_code,
          r.rule_name,
          a.assigned_date,
          a.effective_date,
          a.expiry_date,
          a.is_active,
          a.is_override,
          a.notes,
          a.created_at
        FROM employee_policy_assignments a
        JOIN library_policies p ON a.policy_id = p.id
        JOIN library_policy_rules r ON a.rule_id = r.id
        LEFT JOIN employees e ON a.emp_code = e.emp_code
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );
    
    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getEmployeePolicies(empCode: string) {
    const [rows] = await this.db.execute(
      `
        SELECT 
          a.id as assignment_id,
          p.id as policy_id,
          p.policy_code,
          p.policy_name,
          p.category,
          r.id as rule_id,
          r.rule_code,
          r.rule_name,
          a.assigned_date,
          a.effective_date,
          a.expiry_date,
          a.is_override,
          a.notes,
          CASE 
            WHEN a.effective_date IS NULL OR a.effective_date <= CURDATE() THEN 'Active'
            WHEN a.effective_date > CURDATE() THEN 'Pending'
            WHEN a.expiry_date IS NOT NULL AND a.expiry_date < CURDATE() THEN 'Expired'
            ELSE 'Active'
          END as status
        FROM employee_policy_assignments a
        JOIN library_policies p ON a.policy_id = p.id
        JOIN library_policy_rules r ON a.rule_id = r.id
        WHERE a.emp_code = ? AND a.is_active = true
        ORDER BY p.policy_name
      `,
      [empCode],
    );
    
    return {
      emp_code: empCode,
      policies: rows,
      total: (rows as any[]).length,
    };
  }

  async createPolicyAssignment(dto: CreatePolicyAssignmentDto) {
    // Check if employee exists
    const [employee] = await this.db.execute(
      'SELECT emp_code FROM employees WHERE emp_code = ?',
      [dto.emp_code],
    );
    
    if ((employee as any[]).length === 0) {
      throw new NotFoundException(`Employee '${dto.emp_code}' not found`);
    }
    
    // Check if policy and rule exist
    const [policy] = await this.db.execute(
      'SELECT id FROM library_policies WHERE id = ? AND is_active = true',
      [dto.policy_id],
    );
    
    if ((policy as any[]).length === 0) {
      throw new NotFoundException(`Policy ID ${dto.policy_id} not found or inactive`);
    }
    
    const [rule] = await this.db.execute(
      'SELECT id FROM library_policy_rules WHERE id = ? AND policy_id = ? AND is_active = true',
      [dto.rule_id, dto.policy_id],
    );
    
    if ((rule as any[]).length === 0) {
      throw new BadRequestException(`Rule ID ${dto.rule_id} not found or does not belong to policy ${dto.policy_id}`);
    }
    
    // Deactivate any existing active assignment for this employee+policy
    await this.db.execute(
      `UPDATE employee_policy_assignments 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE emp_code = ? AND policy_id = ? AND is_active = true`,
      [dto.emp_code, dto.policy_id],
    );
    
    // Create new assignment
    const [result] = await this.db.execute(
      `INSERT INTO employee_policy_assignments 
       (emp_code, policy_id, rule_id, assigned_date, effective_date, expiry_date, 
        assigned_by, is_active, is_override, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.emp_code,
        dto.policy_id,
        dto.rule_id,
        dto.assigned_date,
        dto.effective_date || null,
        dto.expiry_date || null,
        dto.assigned_by || null,
        true,
        dto.is_override || false,
        dto.notes || null,
      ],
    );
    
    return {
      id: (result as any).insertId,
      message: 'Policy assigned successfully',
    };
  }

  async updatePolicyAssignment(id: number, dto: UpdatePolicyAssignmentDto) {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (dto.rule_id !== undefined) {
      updates.push('rule_id = ?');
      values.push(dto.rule_id);
    }
    if (dto.effective_date !== undefined) {
      updates.push('effective_date = ?');
      values.push(dto.effective_date);
    }
    if (dto.expiry_date !== undefined) {
      updates.push('expiry_date = ?');
      values.push(dto.expiry_date);
    }
    if (dto.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.is_active);
    }
    if (dto.is_override !== undefined) {
      updates.push('is_override = ?');
      values.push(dto.is_override);
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      values.push(dto.notes);
    }
    
    if (updates.length === 0) {
      return { id, message: 'No changes made' };
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const [result] = await this.db.execute(
      `UPDATE employee_policy_assignments SET ${updates.join(', ')} WHERE id = ?`,
      values,
    );
    
    if ((result as any).affectedRows === 0) {
      throw new NotFoundException('Assignment not found');
    }
    
    return { id, message: 'Assignment updated successfully' };
  }

  async deletePolicyAssignment(id: number) {
    const [result] = await this.db.execute(
      'DELETE FROM employee_policy_assignments WHERE id = ?',
      [id],
    );
    
    if ((result as any).affectedRows === 0) {
      throw new NotFoundException('Assignment not found');
    }
    
    return { success: true, message: 'Assignment deleted' };
  }

  async bulkAssignPolicies(dto: BulkAssignDto) {
    const { policy_id, rule_id, filter_criteria, effective_date, notes } = dto;
    
    // Build employee filter query
    let empWhere = 'WHERE 1=1';
    const empParams: any[] = [];
    
    if (filter_criteria.departments?.length > 0) {
      empWhere += ` AND department IN (${filter_criteria.departments.map(() => '?').join(',')})`;
      empParams.push(...filter_criteria.departments);
    }
    if (filter_criteria.designations?.length > 0) {
      empWhere += ` AND designation IN (${filter_criteria.designations.map(() => '?').join(',')})`;
      empParams.push(...filter_criteria.designations);
    }
    if (filter_criteria.categories?.length > 0) {
      empWhere += ` AND category IN (${filter_criteria.categories.map(() => '?').join(',')})`;
      empParams.push(...filter_criteria.categories);
    }
    if (filter_criteria.emp_codes?.length > 0) {
      empWhere += ` AND emp_code IN (${filter_criteria.emp_codes.map(() => '?').join(',')})`;
      empParams.push(...filter_criteria.emp_codes);
    }
    
    // Get matching employees
    const [employees] = await this.db.execute(
      `SELECT emp_code FROM employees ${empWhere}`,
      empParams,
    );
    
    const empCodes = (employees as any[]).map(e => e.emp_code);
    
    if (empCodes.length === 0) {
      return {
        total_affected: 0,
        successful: 0,
        failed: 0,
        message: 'No employees matched the criteria',
      };
    }
    
    // Deactivate existing assignments for these employees
    await this.db.execute(
      `UPDATE employee_policy_assignments 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE policy_id = ? AND emp_code IN (${empCodes.map(() => '?').join(',')}) AND is_active = true`,
      [policy_id, ...empCodes],
    );
    
    // Create new assignments
    let successful = 0;
    const failed: string[] = [];
    
    for (const empCode of empCodes) {
      try {
        await this.db.execute(
          `INSERT INTO employee_policy_assignments 
           (emp_code, policy_id, rule_id, assigned_date, effective_date, is_active, notes)
           VALUES (?, ?, ?, CURDATE(), ?, true, ?)`,
          [empCode, policy_id, rule_id, effective_date || null, notes || null],
        );
        successful++;
      } catch (error) {
        failed.push(empCode);
      }
    }
    
    // Log bulk assignment job
    await this.db.execute(
      `INSERT INTO library_bulk_assignments 
       (job_name, policy_id, rule_id, filter_criteria, total_affected, successful_assignments, failed_assignments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `Bulk Assign - ${new Date().toISOString()}`,
        policy_id,
        rule_id,
        JSON.stringify(filter_criteria),
        empCodes.length,
        successful,
        failed.length,
      ],
    );
    
    return {
      total_affected: empCodes.length,
      successful,
      failed: failed.length,
      failed_employees: failed,
      message: `Successfully assigned policy to ${successful} employees`,
    };
  }

  async copyPolicyAssignments(fromEmpCode: string, toEmpCodes: string[]) {
    // Get source employee's active assignments
    const [sourceAssignments] = await this.db.execute(
      `SELECT policy_id, rule_id, effective_date, expiry_date, notes
       FROM employee_policy_assignments
       WHERE emp_code = ? AND is_active = true`,
      [fromEmpCode],
    );
    
    if ((sourceAssignments as any[]).length === 0) {
      throw new BadRequestException(`No active policy assignments found for employee ${fromEmpCode}`);
    }
    
    let successful = 0;
    const failed: { emp_code: string; error: string }[] = [];
    
    for (const toEmpCode of toEmpCodes) {
      try {
        // Deactivate existing assignments for this employee
        await this.db.execute(
          `UPDATE employee_policy_assignments 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE emp_code = ? AND is_active = true`,
          [toEmpCode],
        );
        
        // Copy all assignments
        for (const assignment of sourceAssignments as any[]) {
          await this.db.execute(
            `INSERT INTO employee_policy_assignments 
             (emp_code, policy_id, rule_id, assigned_date, effective_date, expiry_date, notes, is_active)
             VALUES (?, ?, ?, CURDATE(), ?, ?, ?, true)`,
            [
              toEmpCode,
              assignment.policy_id,
              assignment.rule_id,
              assignment.effective_date,
              assignment.expiry_date,
              `Copied from ${fromEmpCode}`,
            ],
          );
        }
        successful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({ emp_code: toEmpCode, error: errorMessage });
      }
    }
    
    return {
      copied_from: fromEmpCode,
      total_target_employees: toEmpCodes.length,
      successful,
      failed: failed.length,
      failed_details: failed,
      assignments_copied: (sourceAssignments as any[]).length,
      message: `Successfully copied policy assignments to ${successful} employees`,
    };
  }

  // ==========================================
  // POLICY TEMPLATES
  // ==========================================

  async getPolicyTemplates() {
    const [rows] = await this.db.execute(
      `SELECT 
        p.*,
        COUNT(r.id) as rule_count
      FROM library_policies p
      LEFT JOIN library_policy_rules r ON p.id = r.policy_id
      WHERE p.is_template = true
      GROUP BY p.id
      ORDER BY p.policy_name`
    );
    return rows;
  }

  async createPolicyFromTemplate(templateId: number, newCode: string, newName: string) {
    const template = await this.getPolicyById(templateId, true);
    
    if (!template.is_template) {
      throw new BadRequestException('Source policy is not marked as a template');
    }
    
    // Check for duplicate code
    const [existing] = await this.db.execute(
      'SELECT id FROM library_policies WHERE policy_code = ?',
      [newCode],
    );
    
    if ((existing as any[]).length > 0) {
      throw new BadRequestException(`Policy code '${newCode}' already exists`);
    }
    
    const [result] = await this.db.execute(
      `INSERT INTO library_policies 
       (policy_code, policy_name, description, category, is_active, is_template, version) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newCode,
        newName,
        template.description,
        template.category,
        false,
        false,
        1,
      ],
    );
    
    const newPolicyId = (result as any).insertId;
    
    // Copy all rules from template
    if (template.rules && template.rules.length > 0) {
      for (const rule of template.rules) {
        await this.db.execute(
          `INSERT INTO library_policy_rules 
           (policy_id, rule_code, rule_name, description, conditions, calculation_formula, 
            is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newPolicyId,
            rule.rule_code,
            rule.rule_name,
            rule.description,
            rule.conditions,
            rule.calculation_formula,
            rule.is_active,
          ],
        );
      }
    }
    
    return {
      id: newPolicyId,
      message: 'Policy created from template successfully',
      template_id: templateId,
    };
  }

  // Get active policies with their rules (for dropdowns)
  async getActivePoliciesWithRules() {
    const [rows] = await this.db.execute(
      `SELECT * FROM library_policies 
       WHERE is_active = true 
       ORDER BY policy_name`,
    );
    const policies = rows as any[];
    
    for (const policy of policies) {
      const [rules] = await this.db.execute(
        `SELECT id, rule_code, rule_name, description 
         FROM library_policy_rules 
         WHERE policy_id = ? AND is_active = true 
         ORDER BY rule_code`,
        [policy.id],
      );
      policy.rules = rules;
    }
    
    return policies;
  }

  // Helper to create default rules
  private async createDefaultRules(policyId: number) {
    const defaultRules = [
      { code: 'RULE_1', name: 'Rule 1', desc: 'Standard rule - Default configuration' },
      { code: 'RULE_2', name: 'Rule 2', desc: 'Secondary rule - Alternative configuration' },
      { code: 'RULE_3', name: 'Rule 3', desc: 'Special case rule - Exception handling' },
      { code: 'NA', name: 'N/A', desc: 'Not Applicable - Policy does not apply' },
    ];
    
    for (const rule of defaultRules) {
      await this.db.execute(
        `INSERT INTO library_policy_rules 
         (policy_id, rule_code, rule_name, description, is_active) 
         VALUES (?, ?, ?, ?, ?)`,
        [policyId, rule.code, rule.name, rule.desc, true],
      );
    }
  }
}
