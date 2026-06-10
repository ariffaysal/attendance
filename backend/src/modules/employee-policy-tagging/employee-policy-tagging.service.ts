import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { CreatePolicyTaggingDto, UpdatePolicyTaggingDto } from './dto/create-policy-tagging.dto';

@Injectable()
export class EmployeePolicyTaggingService {
  constructor(
    @Inject(SQL_CONNECTION) private connection: mysql.Connection,
  ) {}

  // Transform snake_case DB results to camelCase for API
  private transformToCamelCase(row: any): any {
    if (!row) return null;
    return {
      id: row.id,
      // Identity columns (only 2 columns: Name and AC-No.)
      acNo: row['AC-No.'] || '',
      name: row.Name || '',
      // Employee info
      category: row.category,
      company: row.company,
      location: row.location,
      division: row.division,
      department: row.department,
      section: row.section,
      subsection: row.subsection,
      designation: row.designation,
      // Policies (all 16 policies with their date fields)
      overtimePolicyRule: row.overtime_policy_rule,
      overtimePolicyDate: row.overtime_policy_date,
      holidayIncentiveRule: row.holiday_incentive_rule,
      holidayIncentiveDate: row.holiday_incentive_date,
      dutyRosterPolicyRule: row.duty_roster_policy_rule,
      dutyRosterPolicyDate: row.duty_roster_policy_date,
      leavePolicyRule: row.leave_policy_rule,
      leavePolicyDate: row.leave_policy_date,
      maternityLeavePolicyRule: row.maternity_leave_policy_rule,
      maternityLeavePolicyDate: row.maternity_leave_policy_date,
      attendanceBonusPolicyRule: row.attendance_bonus_policy_rule,
      attendanceBonusPolicyDate: row.attendance_bonus_policy_date,
      absentDeductionPolicyRule: row.absent_deduction_policy_rule,
      absentDeductionPolicyDate: row.absent_deduction_policy_date,
      lateDeductionPolicyRule: row.late_deduction_policy_rule,
      lateDeductionPolicyDate: row.late_deduction_policy_date,
      bonusPolicyRule: row.bonus_policy_rule,
      bonusPolicyDate: row.bonus_policy_date,
      taxPolicyRule: row.tax_policy_rule,
      taxPolicyDate: row.tax_policy_date,
      shiftPolicyRule: row.shift_policy_rule,
      shiftPolicyDate: row.shift_policy_date,
      tiffinBillPolicyRule: row.tiffin_bill_policy_rule,
      tiffinBillPolicyDate: row.tiffin_bill_policy_date,
      allowancePolicyRule: row.allowance_policy_rule,
      allowancePolicyDate: row.allowance_policy_date,
      earlyOutDeductionPolicyRule: row.early_out_deduction_policy_rule,
      earlyOutDeductionPolicyDate: row.early_out_deduction_policy_date,
      serviceBenefitPolicyRule: row.service_benefit_policy_rule,
      serviceBenefitPolicyDate: row.service_benefit_policy_date,
      hdDeductRuleRule: row.hd_deduct_rule_rule,
      hdDeductRuleDate: row.hd_deduct_rule_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(search?: string): Promise<any[]> {
    let query = `SELECT * FROM employee_policy_tagging`;
    const params: any[] = [];

    if (search) {
      query += ` WHERE \`AC-No.\` LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY id ASC';

    const [rows] = await this.connection.execute(query, params);
    return (rows as any[]).map(row => this.transformToCamelCase(row));
  }

  async findOne(id: number): Promise<any> {
    const query = `SELECT * FROM employee_policy_tagging WHERE id = ?`;
    const [rows] = await this.connection.execute(query, [id]);

    const records = rows as any[];
    if (records.length === 0) {
      throw new NotFoundException('Employee policy tagging not found');
    }
    return this.transformToCamelCase(records[0]);
  }

  async findByACNo(acNo: string): Promise<any | null> {
    const query = `SELECT * FROM employee_policy_tagging WHERE \`AC-No.\` = ? LIMIT 1`;
    const [rows] = await this.connection.execute(query, [acNo]);

    const records = rows as any[];
    return records.length > 0 ? this.transformToCamelCase(records[0]) : null;
  }

  // Alias for backward compatibility (deprecated)
  async findByEmpCode(empCode: string): Promise<any | null> {
    return this.findByACNo(empCode);
  }

  async create(dto: CreatePolicyTaggingDto): Promise<any> {
    console.log('DEBUG: Backend create DTO:', JSON.stringify(dto, null, 2));
    
    // Use the exact data from frontend (no lookup to avoid wrong person selection)
    const acNo = dto.acNo || '';
    const name = dto.name || '';
    
    // Check for duplicate AC-No.
    if (acNo) {
      const existing = await this.findByACNo(acNo);
      if (existing) {
        throw new BadRequestException('Employee with this AC-No. already has policy tagging');
      }
    }
    
    if (!acNo) {
      throw new BadRequestException('AC-No. is required. Please select a valid employee.');
    }

    const sql = `
      INSERT INTO employee_policy_tagging (
        \`AC-No.\`, \`Name\`, category, company, location, division, department, section, subsection, designation,
        overtime_policy_rule, overtime_policy_date, holiday_incentive_rule, holiday_incentive_date,
        duty_roster_policy_rule, duty_roster_policy_date, leave_policy_rule, leave_policy_date,
        maternity_leave_policy_rule, maternity_leave_policy_date, attendance_bonus_policy_rule, attendance_bonus_policy_date,
        absent_deduction_policy_rule, absent_deduction_policy_date, late_deduction_policy_rule, late_deduction_policy_date,
        bonus_policy_rule, bonus_policy_date, tax_policy_rule, tax_policy_date,
        shift_policy_rule, shift_policy_date, tiffin_bill_policy_rule, tiffin_bill_policy_date,
        allowance_policy_rule, allowance_policy_date, early_out_deduction_policy_rule, early_out_deduction_policy_date,
        service_benefit_policy_rule, service_benefit_policy_date, hd_deduct_rule_policy_rule, hd_deduct_rule_policy_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      acNo || '',
      name || '',
      dto.category || null,
      dto.company || null,
      dto.location || null,
      dto.division || null,
      dto.department || null,
      dto.section || null,
      dto.subsection || null,
      dto.designation || null,
      dto.overtimePolicyRule || null,
      dto.overtimePolicyDate || null,
      dto.holidayIncentiveRule || null,
      dto.holidayIncentiveDate || null,
      dto.dutyRosterPolicyRule || null,
      dto.dutyRosterPolicyDate || null,
      dto.leavePolicyRule || null,
      dto.leavePolicyDate || null,
      dto.maternityLeavePolicyRule || null,
      dto.maternityLeavePolicyDate || null,
      dto.attendanceBonusPolicyRule || null,
      dto.attendanceBonusPolicyDate || null,
      dto.absentDeductionPolicyRule || null,
      dto.absentDeductionPolicyDate || null,
      dto.lateDeductionPolicyRule || null,
      dto.lateDeductionPolicyDate || null,
      dto.bonusPolicyRule || null,
      dto.bonusPolicyDate || null,
      dto.taxPolicyRule || null,
      dto.taxPolicyDate || null,
      dto.shiftPolicyRule || null,
      dto.shiftPolicyDate || null,
      dto.tiffinBillPolicyRule || null,
      dto.tiffinBillPolicyDate || null,
      dto.allowancePolicyRule || null,
      dto.allowancePolicyDate || null,
      dto.earlyOutDeductionPolicyRule || null,
      dto.earlyOutDeductionPolicyDate || null,
      dto.serviceBenefitPolicyRule || null,
      dto.serviceBenefitPolicyDate || null,
      dto.hdDeductRulePolicyRule || null,
      dto.hdDeductRulePolicyDate || null,
    ];

    const [result] = await this.connection.execute(sql, values);
    const insertId = (result as mysql.OkPacket).insertId;
    return this.findOne(insertId);
  }

  async update(id: number, dto: UpdatePolicyTaggingDto): Promise<any> {
    await this.findOne(id);

    // Get raw row for update
    const [existingRows] = await this.connection.execute(
      'SELECT * FROM employee_policy_tagging WHERE id = ?',
      [id],
    );
    const rawExisting = (existingRows as any[])[0];

    const sql = `
      UPDATE employee_policy_tagging SET
        category = ?,
        company = ?,
        location = ?,
        division = ?,
        department = ?,
        section = ?,
        subsection = ?,
        designation = ?,
        overtime_policy_rule = ?, overtime_policy_date = ?,
        holiday_incentive_rule = ?, holiday_incentive_date = ?,
        duty_roster_policy_rule = ?, duty_roster_policy_date = ?,
        leave_policy_rule = ?, leave_policy_date = ?,
        maternity_leave_policy_rule = ?, maternity_leave_policy_date = ?,
        attendance_bonus_policy_rule = ?, attendance_bonus_policy_date = ?,
        absent_deduction_policy_rule = ?, absent_deduction_policy_date = ?,
        late_deduction_policy_rule = ?, late_deduction_policy_date = ?,
        bonus_policy_rule = ?, bonus_policy_date = ?,
        tax_policy_rule = ?, tax_policy_date = ?,
        shift_policy_rule = ?, shift_policy_date = ?,
        tiffin_bill_policy_rule = ?, tiffin_bill_policy_date = ?,
        allowance_policy_rule = ?, allowance_policy_date = ?,
        early_out_deduction_policy_rule = ?, early_out_deduction_policy_date = ?,
        service_benefit_policy_rule = ?, service_benefit_policy_date = ?,
        hd_deduct_rule_policy_rule = ?, hd_deduct_rule_policy_date = ?
      WHERE id = ?
    `;

    // Helper to handle undefined values - convert to null for SQL
    const getValue = (dtoValue: any, existingValue: any) => {
      if (dtoValue !== undefined) {
        return dtoValue === '' ? null : dtoValue;
      }
      // Even existing values might be undefined, so handle them too
      return existingValue === undefined ? null : existingValue;
    };
    
    const values = [
      getValue(dto.category, rawExisting.category),
      getValue(dto.company, rawExisting.company),
      getValue(dto.location, rawExisting.location),
      getValue(dto.division, rawExisting.division),
      getValue(dto.department, rawExisting.department),
      getValue(dto.section, rawExisting.section),
      getValue(dto.subsection, rawExisting.subsection),
      getValue(dto.designation, rawExisting.designation),
      getValue(dto.overtimePolicyRule, rawExisting.overtime_policy_rule),
      getValue(dto.overtimePolicyDate, rawExisting.overtime_policy_date),
      getValue(dto.holidayIncentiveRule, rawExisting.holiday_incentive_rule),
      getValue(dto.holidayIncentiveDate, rawExisting.holiday_incentive_date),
      getValue(dto.dutyRosterPolicyRule, rawExisting.duty_roster_policy_rule),
      getValue(dto.dutyRosterPolicyDate, rawExisting.duty_roster_policy_date),
      getValue(dto.leavePolicyRule, rawExisting.leave_policy_rule),
      getValue(dto.leavePolicyDate, rawExisting.leave_policy_date),
      getValue(dto.maternityLeavePolicyRule, rawExisting.maternity_leave_policy_rule),
      getValue(dto.maternityLeavePolicyDate, rawExisting.maternity_leave_policy_date),
      getValue(dto.attendanceBonusPolicyRule, rawExisting.attendance_bonus_policy_rule),
      getValue(dto.attendanceBonusPolicyDate, rawExisting.attendance_bonus_policy_date),
      getValue(dto.absentDeductionPolicyRule, rawExisting.absent_deduction_policy_rule),
      getValue(dto.absentDeductionPolicyDate, rawExisting.absent_deduction_policy_date),
      getValue(dto.lateDeductionPolicyRule, rawExisting.late_deduction_policy_rule),
      getValue(dto.lateDeductionPolicyDate, rawExisting.late_deduction_policy_date),
      getValue(dto.bonusPolicyRule, rawExisting.bonus_policy_rule),
      getValue(dto.bonusPolicyDate, rawExisting.bonus_policy_date),
      getValue(dto.taxPolicyRule, rawExisting.tax_policy_rule),
      getValue(dto.taxPolicyDate, rawExisting.tax_policy_date),
      getValue(dto.shiftPolicyRule, rawExisting.shift_policy_rule),
      getValue(dto.shiftPolicyDate, rawExisting.shift_policy_date),
      getValue(dto.tiffinBillPolicyRule, rawExisting.tiffin_bill_policy_rule),
      getValue(dto.tiffinBillPolicyDate, rawExisting.tiffin_bill_policy_date),
      getValue(dto.allowancePolicyRule, rawExisting.allowance_policy_rule),
      getValue(dto.allowancePolicyDate, rawExisting.allowance_policy_date),
      getValue(dto.earlyOutDeductionPolicyRule, rawExisting.early_out_deduction_policy_rule),
      getValue(dto.earlyOutDeductionPolicyDate, rawExisting.early_out_deduction_policy_date),
      getValue(dto.serviceBenefitPolicyRule, rawExisting.service_benefit_policy_rule),
      getValue(dto.serviceBenefitPolicyDate, rawExisting.service_benefit_policy_date),
      getValue(dto.hdDeductRulePolicyRule, rawExisting.hd_deduct_rule_policy_rule),
      getValue(dto.hdDeductRulePolicyDate, rawExisting.hd_deduct_rule_policy_date),
      id,
    ];

    // Debug: Check for any undefined values before executing
    for (let i = 0; i < values.length; i++) {
      if (values[i] === undefined) {
        console.error(`Undefined value at index ${i}:`, values[i]);
        values[i] = null; // Fix undefined values
      }
    }
    
    await this.connection.execute(sql, values);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.connection.execute(
      'DELETE FROM employee_policy_tagging WHERE id = ?',
      [id],
    );
  }
}
