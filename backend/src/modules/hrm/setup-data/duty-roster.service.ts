import { Injectable, Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../../database/database.module';

export interface ShiftValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  prevShift?: {
    shiftCode: string;
    endTime: string;
    assignmentDate: string;
  };
  nextShift?: {
    shiftCode: string;
    startTime: string;
    assignmentDate: string;
  };
  restHours?: number;
  requiredRestHours?: number;
}

export interface ShiftAssignmentDto {
  empCode: string;
  assignmentDate: string; // YYYY-MM-DD
  shiftId: number;
  notes?: string;
  createdBy?: string;
}

export interface BulkShiftAssignmentDto {
  empCodes: string[];
  startDate: string;
  endDate: string;
  shiftId: number;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

export interface RosterTemplate {
  id: number;
  templateName: string;
  templateCode: string;
  cycleDays: number;
  pattern: string[];
}

export interface RosterGenerationResult {
  success: boolean;
  totalAssignments: number;
  violationsFound: number;
  violationsResolved: number;
  errors: string[];
  assignmentsByEmployee: Map<string, number>;
}

@Injectable()
export class DutyRosterService {
  constructor(
    @Inject(SQL_CONNECTION) private readonly db: mysql.Connection,
  ) {}

  /**
   * Validate a shift assignment against duty roster constraints
   * Checks: 
   * 1. Previous day shift transition rules
   * 2. Consecutive night shift limits
   * 3. Rest hours between shifts
   */
  async validateShiftAssignment(
    empCode: string,
    newShiftId: number,
    assignmentDate: string,
    checkRosterPolicy: boolean = true
  ): Promise<ShiftValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // If no roster policy check requested, just validate basic constraints
    if (!checkRosterPolicy) {
      return { valid: true, errors, warnings };
    }
    
    try {
      // Get new shift details
      const newShift = await this.getShiftById(newShiftId);
      if (!newShift) {
        errors.push(`Invalid shift ID: ${newShiftId}`);
        return { valid: false, errors, warnings };
      }
      
      // Check previous day assignment
      const prevDate = this.getPreviousDate(assignmentDate);
      const prevAssignment = await this.getEmployeeShiftAssignment(empCode, prevDate);
      
      // Check next day assignment (to prevent creating future violations)
      const nextDate = this.getNextDate(assignmentDate);
      const nextAssignment = await this.getEmployeeShiftAssignment(empCode, nextDate);
      
      // If previous day has a shift, check transition rules
      if (prevAssignment && !prevAssignment.isOffDay) {
        const prevShift = await this.getShiftById(prevAssignment.shiftId);
        
        if (prevShift) {
          // Check hard constraints
          const constraint = await this.getRosterConstraint(prevShift.id, newShiftId);
          
          // Calculate rest hours
          const restHours = this.calculateRestHours(
            prevDate,
            prevShift.endTime,
            prevShift.isNightShift,
            assignmentDate,
            newShift.startTime
          );
          
          if (constraint) {
            if (restHours < constraint.minRestHours) {
              const message = constraint.errorMessage || 
                `Rest period too short: ${restHours}h available, ${constraint.minRestHours}h required`;
              
              if (constraint.isHardConstraint) {
                errors.push(message);
              } else {
                warnings.push(message);
              }
            }
          }
          
          // Check for night shift -> morning/day transition without sufficient rest
          if (prevShift.isNightShift && !newShift.isNightShift) {
            if (restHours < 12) {
              errors.push(`Night shift to ${newShift.shiftName} requires 12 hours rest. Only ${restHours}h available.`);
            }
          }
          
          // Check consecutive night shifts
          if (newShift.isNightShift) {
            const consecutiveNights = await this.countConsecutiveNightShifts(empCode, assignmentDate);
            if (consecutiveNights >= (newShift.maxConsecutiveDays || 3)) {
              errors.push(`Maximum ${newShift.maxConsecutiveDays || 3} consecutive night shifts allowed. Rest required.`);
            }
          }
        }
      }
      
      // Check if next day assignment would violate rules
      if (nextAssignment && !nextAssignment.isOffDay) {
        const nextShift = await this.getShiftById(nextAssignment.shiftId);
        
        if (nextShift) {
          const constraint = await this.getRosterConstraint(newShiftId, nextShift.id);
          
          const restHours = this.calculateRestHours(
            assignmentDate,
            newShift.endTime,
            newShift.isNightShift,
            nextDate,
            nextShift.startTime
          );
          
          if (constraint && restHours < constraint.minRestHours) {
            const message = constraint.errorMessage || 
              `This assignment would leave only ${restHours}h rest before next shift (requires ${constraint.minRestHours}h)`;
            
            if (constraint.isHardConstraint) {
              warnings.push(message + ' (Will require adjustment)');
            } else {
              warnings.push(message);
            }
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        prevShift: prevAssignment ? {
          shiftCode: prevAssignment.shiftCode,
          endTime: prevAssignment.endTime,
          assignmentDate: prevDate
        } : undefined,
        nextShift: nextAssignment ? {
          shiftCode: nextAssignment.shiftCode,
          startTime: nextAssignment.startTime,
          assignmentDate: nextDate
        } : undefined,
        restHours: prevAssignment ? 
          this.calculateRestHours(prevDate, prevAssignment.endTime, prevAssignment.isNightShift, assignmentDate, newShift.startTime) :
          undefined,
        requiredRestHours: prevAssignment ? 
          (await this.getRequiredRestHours(prevAssignment.shiftId, newShiftId)) : undefined
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Roster] Error validating shift assignment:', error);
      errors.push(`Validation error: ${errorMessage}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Assign shift to employee for a specific date
   * Includes validation and roster policy check
   */
  async assignShift(dto: ShiftAssignmentDto, validate: boolean = true): Promise<{
    success: boolean;
    id?: number;
    validation?: ShiftValidationResult;
    error?: string;
  }> {
    try {
      // Check if employee has roster policy
      const hasRosterPolicy = await this.checkEmployeeRosterPolicy(dto.empCode);
      
      // Validate if requested and roster policy is set
      let validation: ShiftValidationResult | undefined;
      if (validate && hasRosterPolicy) {
        validation = await this.validateShiftAssignment(
          dto.empCode, 
          dto.shiftId, 
          dto.assignmentDate,
          true
        );
        
        // Block if hard constraints violated
        if (!validation.valid) {
          return {
            success: false,
            validation,
            error: `Roster constraints violated: ${validation.errors.join(', ')}`
          };
        }
      }
      
      // Insert or update assignment
      const [result] = await this.db.execute(
        `INSERT INTO employee_shift_assignments 
         (emp_code, assignment_date, shift_id, is_off_day, notes, created_by)
         VALUES (?, ?, ?, FALSE, ?, ?)
         ON DUPLICATE KEY UPDATE 
         shift_id = VALUES(shift_id),
         is_off_day = FALSE,
         is_duty_roster_applied = FALSE,
         notes = VALUES(notes),
         updated_at = CURRENT_TIMESTAMP`,
        [dto.empCode, dto.assignmentDate, dto.shiftId, dto.notes || '', dto.createdBy || 'SYSTEM']
      );
      
      const insertId = (result as any).insertId;
      
      return {
        success: true,
        id: insertId,
        validation
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Roster] Error assigning shift:', error);
      return {
        success: false,
        error: `Failed to assign shift: ${errorMessage}`
      };
    }
  }

  /**
   * Bulk assign shifts for date range
   */
  async bulkAssignShifts(dto: BulkShiftAssignmentDto): Promise<{
    success: boolean;
    totalAssigned: number;
    failed: Array<{ empCode: string; date: string; error: string }>;
    warnings: string[];
  }> {
    const failed: Array<{ empCode: string; date: string; error: string }> = [];
    const warnings: string[] = [];
    let totalAssigned = 0;
    
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    
    for (const empCode of dto.empCodes) {
      const hasRosterPolicy = await this.checkEmployeeRosterPolicy(empCode);
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Skip weekends if requested
        if (dto.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        const result = await this.assignShift({
          empCode,
          assignmentDate: dateStr,
          shiftId: dto.shiftId,
          createdBy: 'BULK_ASSIGN'
        }, hasRosterPolicy); // Only validate if roster policy is set
        
        if (result.success) {
          totalAssigned++;
          if (result.validation?.warnings.length) {
            warnings.push(`${empCode} on ${dateStr}: ${result.validation.warnings.join(', ')}`);
          }
        } else {
          failed.push({ empCode, date: dateStr, error: result.error || 'Unknown error' });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return {
      success: failed.length === 0,
      totalAssigned,
      failed,
      warnings
    };
  }

  /**
   * Generate roster from template for month
   */
  async generateRosterFromTemplate(
    templateId: number,
    monthYear: string, // YYYY-MM
    empCodes: string[] | 'ALL',
    generatedBy: string = 'SYSTEM'
  ): Promise<RosterGenerationResult> {
    const result: RosterGenerationResult = {
      success: false,
      totalAssignments: 0,
      violationsFound: 0,
      violationsResolved: 0,
      errors: [],
      assignmentsByEmployee: new Map()
    };
    
    try {
      // Get template
      const template = await this.getRosterTemplate(templateId);
      if (!template) {
        result.errors.push(`Template ${templateId} not found`);
        return result;
      }
      
      // Get employees
      let employees: string[];
      if (empCodes === 'ALL') {
        employees = await this.getAllActiveEmployeeCodes();
      } else {
        employees = empCodes;
      }
      
      // Get days in month
      const [year, month] = monthYear.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Generate assignments for each employee
      for (const empCode of employees) {
        let empAssignments = 0;
        const hasRosterPolicy = await this.checkEmployeeRosterPolicy(empCode);
        
        // Find or create cycle start for this employee
        let cycleStart = await this.getEmployeeCycleStart(empCode, templateId);
        if (!cycleStart) {
          cycleStart = new Date(year, month - 1, 1);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month - 1, day);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Calculate position in cycle
          const dayIndex = this.calculateDayIndex(currentDate, cycleStart, template.cycleDays);
          const shiftCode = template.pattern[dayIndex];
          
          if (shiftCode === 'OFF') {
            // Mark as off day
            await this.markOffDay(empCode, dateStr);
            continue;
          }
          
          // Get shift ID
          const shift = await this.getShiftByCode(shiftCode);
          if (!shift) {
            result.errors.push(`Shift ${shiftCode} not found for ${empCode} on ${dateStr}`);
            continue;
          }
          
          // Validate if roster policy set
          if (hasRosterPolicy) {
            const validation = await this.validateShiftAssignment(
              empCode, shift.id, dateStr, true
            );
            
            if (!validation.valid) {
              result.violationsFound++;
              // Try to resolve by inserting an off day before
              const resolved = await this.tryResolveViolation(empCode, dateStr, shift.id, validation);
              if (resolved) {
                result.violationsResolved++;
              } else {
                result.errors.push(`${empCode} on ${dateStr}: ${validation.errors.join(', ')}`);
                continue;
              }
            }
          }
          
          // Assign shift
          const assignResult = await this.assignShift({
            empCode,
            assignmentDate: dateStr,
            shiftId: shift.id,
            notes: `Auto-generated from template ${template.templateName}`,
            createdBy: generatedBy
          }, false); // Already validated above
          
          if (assignResult.success) {
            result.totalAssignments++;
            empAssignments++;
          }
        }
        
        result.assignmentsByEmployee.set(empCode, empAssignments);
      }
      
      // Log generation
      await this.logRosterGeneration(templateId, monthYear, result, generatedBy);
      
      result.success = result.errors.length === 0 || result.totalAssignments > 0;
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Roster] Error generating roster:', error);
      result.errors.push(`Generation failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get all shifts
   */
  async getAllShifts(): Promise<any[]> {
    const [rows] = await this.db.execute(
      `SELECT * FROM shifts WHERE is_active = TRUE ORDER BY start_time`
    );
    return rows as any[];
  }

  /**
   * Get shift options formatted for dropdown (for policy selection)
   */
  async getShiftOptions(): Promise<any[]> {
    const [rows] = await this.db.execute(
      `SELECT shift_name as label, shift_name as value, shift_code, start_time, end_time, grace_period_minutes
       FROM shifts 
       WHERE is_active = TRUE 
       ORDER BY start_time`
    );
    return rows as any[];
  }

  /**
   * Get shift by ID
   */
  async getShiftById(id: number): Promise<any | null> {
    const [rows] = await this.db.execute(
      `SELECT * FROM shifts WHERE id = ? AND is_active = TRUE`,
      [id]
    );
    const shifts = rows as any[];
    return shifts.length > 0 ? shifts[0] : null;
  }

  /**
   * Get shift by code
   */
  async getShiftByCode(code: string): Promise<any | null> {
    const [rows] = await this.db.execute(
      `SELECT * FROM shifts WHERE shift_code = ? AND is_active = TRUE`,
      [code]
    );
    const shifts = rows as any[];
    return shifts.length > 0 ? shifts[0] : null;
  }

  /**
   * Get employee's shift for a specific date
   */
  async getEmployeeShift(empCode: string, date: string): Promise<any | null> {
    const [rows] = await this.db.execute(
      `SELECT s.*, esa.is_off_day, esa.notes, esa.is_duty_roster_applied
       FROM employee_shift_assignments esa
       JOIN shifts s ON s.id = esa.shift_id
       WHERE esa.emp_code = ? AND esa.assignment_date = ?`,
      [empCode, date]
    );
    const shifts = rows as any[];
    return shifts.length > 0 ? shifts[0] : null;
  }

  /**
   * Get all roster templates
   */
  async getRosterTemplates(): Promise<RosterTemplate[]> {
    const [rows] = await this.db.execute(
      `SELECT * FROM roster_templates WHERE is_active = TRUE`
    );
    return (rows as any[]).map(row => ({
      id: row.id,
      templateName: row.template_name,
      templateCode: row.template_code,
      cycleDays: row.cycle_days,
      pattern: JSON.parse(row.pattern_json)
    }));
  }

  /**
   * Get employee shift calendar for date range
   */
  async getEmployeeShiftCalendar(
    empCode: string,
    fromDate: string,
    toDate: string
  ): Promise<any[]> {
    const [rows] = await this.db.execute(
      `SELECT esa.*, s.shift_code, s.shift_name, s.start_time, s.end_time, s.is_night_shift
       FROM employee_shift_assignments esa
       LEFT JOIN shifts s ON s.id = esa.shift_id
       WHERE esa.emp_code = ? 
         AND esa.assignment_date BETWEEN ? AND ?
       ORDER BY esa.assignment_date`,
      [empCode, fromDate, toDate]
    );
    return rows as any[];
  }

  /**
   * Get all violations in a date range
   */
  async getViolations(fromDate: string, toDate: string): Promise<any[]> {
    const [rows] = await this.db.execute(
      `SELECT * FROM vw_roster_violations 
       WHERE prev_date BETWEEN ? AND ?
       ORDER BY emp_code, next_date`,
      [fromDate, toDate]
    );
    return rows as any[];
  }

  /**
   * Delete shift assignment
   */
  async deleteAssignment(id: number): Promise<boolean> {
    try {
      await this.db.execute(
        `DELETE FROM employee_shift_assignments WHERE id = ?`,
        [id]
      );
      return true;
    } catch (error) {
      console.error('[Roster] Error deleting assignment:', error);
      return false;
    }
  }

  // ============ PRIVATE HELPER METHODS ============

  private async getEmployeeShiftAssignment(empCode: string, date: string): Promise<any | null> {
    const [rows] = await this.db.execute(
      `SELECT esa.*, s.shift_code, s.start_time, s.end_time, s.is_night_shift
       FROM employee_shift_assignments esa
       JOIN shifts s ON s.id = esa.shift_id
       WHERE esa.emp_code = ? AND esa.assignment_date = ? AND esa.is_off_day = FALSE`,
      [empCode, date]
    );
    const assignments = rows as any[];
    return assignments.length > 0 ? assignments[0] : null;
  }

  private async getRosterConstraint(fromShiftId: number, toShiftId: number): Promise<any | null> {
    const [rows] = await this.db.execute(
      `SELECT * FROM duty_roster_constraints 
       WHERE from_shift_id = ? AND to_shift_id = ? AND is_active = TRUE`,
      [fromShiftId, toShiftId]
    );
    const constraints = rows as any[];
    return constraints.length > 0 ? constraints[0] : null;
  }

  private async getRequiredRestHours(fromShiftId: number, toShiftId: number): Promise<number> {
    const constraint = await this.getRosterConstraint(fromShiftId, toShiftId);
    return constraint?.minRestHours || 8;
  }

  private calculateRestHours(
    prevDate: string,
    prevEndTime: string,
    prevIsNight: boolean,
    nextDate: string,
    nextStartTime: string
  ): number {
    const [prevEndHour, prevEndMin] = prevEndTime.split(':').map(Number);
    const [nextStartHour, nextStartMin] = nextStartTime.split(':').map(Number);
    
    // Parse dates
    const prev = new Date(prevDate);
    const next = new Date(nextDate);
    const dayDiff = Math.floor((next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    
    let restMinutes = 0;
    
    if (dayDiff === 1) {
      // Consecutive days
      if (prevIsNight) {
        // Night shift ends next day at end time
        restMinutes = (nextStartHour * 60 + nextStartMin) + (24 - (prevEndHour * 60 + prevEndMin) / 60 * 60 / 60);
      } else {
        // Same day calculation
        restMinutes = (nextStartHour * 60 + nextStartMin) - (prevEndHour * 60 + prevEndMin);
      }
    } else if (dayDiff > 1) {
      // Multiple days gap - plenty of rest
      restMinutes = 24 * 60;
    } else {
      // Same day or invalid
      restMinutes = 0;
    }
    
    // Convert to hours
    return Math.floor(restMinutes / 60);
  }

  private async countConsecutiveNightShifts(empCode: string, fromDate: string): Promise<number> {
    const [rows] = await this.db.execute(
      `SELECT COUNT(*) as count
       FROM employee_shift_assignments esa
       JOIN shifts s ON s.id = esa.shift_id
       WHERE esa.emp_code = ? 
         AND esa.assignment_date BETWEEN DATE_SUB(?, INTERVAL 2 DAY) AND DATE_SUB(?, INTERVAL 1 DAY)
         AND esa.is_off_day = FALSE
         AND s.is_night_shift = TRUE`,
      [empCode, fromDate, fromDate]
    );
    return (rows as any[])[0]?.count || 0;
  }

  private async checkEmployeeRosterPolicy(empCode: string): Promise<boolean> {
    const [rows] = await this.db.execute(
      `SELECT duty_roster_policy_rule 
       FROM employee_policy_tagging 
       WHERE emp_code = ? 
         AND duty_roster_policy_rule IS NOT NULL
         AND duty_roster_policy_rule != ''
         AND duty_roster_policy_rule != 'NO_ROSTER'`,
      [empCode]
    );
    const policies = rows as any[];
    return policies.length > 0;
  }

  private getPreviousDate(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  private getNextDate(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }

  private async getRosterTemplate(id: number): Promise<RosterTemplate | null> {
    const [rows] = await this.db.execute(
      `SELECT * FROM roster_templates WHERE id = ? AND is_active = TRUE`,
      [id]
    );
    const templates = rows as any[];
    if (templates.length === 0) return null;
    
    const t = templates[0];
    return {
      id: t.id,
      templateName: t.template_name,
      templateCode: t.template_code,
      cycleDays: t.cycle_days,
      pattern: JSON.parse(t.pattern_json)
    };
  }

  private async getAllActiveEmployeeCodes(): Promise<string[]> {
    const [rows] = await this.db.execute(
      `SELECT DISTINCT emp_code FROM employees WHERE status = 'Active' ORDER BY emp_code`
    );
    return (rows as any[]).map(r => r.emp_code);
  }

  private async getEmployeeCycleStart(empCode: string, templateId: number): Promise<Date | null> {
    const [rows] = await this.db.execute(
      `SELECT cycle_start_date 
       FROM employee_roster_assignments 
       WHERE emp_code = ? AND template_id = ? AND is_active = TRUE
       ORDER BY cycle_start_date DESC
       LIMIT 1`,
      [empCode, templateId]
    );
    const assignments = rows as any[];
    if (assignments.length === 0) return null;
    return new Date(assignments[0].cycle_start_date);
  }

  private calculateDayIndex(currentDate: Date, cycleStart: Date, cycleDays: number): number {
    const diffTime = currentDate.getTime() - cycleStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const index = diffDays % cycleDays;
    return index < 0 ? index + cycleDays : index;
  }

  private async markOffDay(empCode: string, dateStr: string): Promise<void> {
    // Get default shift ID for off day reference
    const [rows] = await this.db.execute(
      `SELECT id FROM shifts WHERE shift_code = 'GENERAL' LIMIT 1`
    );
    const shifts = rows as any[];
    const shiftId = shifts.length > 0 ? shifts[0].id : 1;
    
    await this.db.execute(
      `INSERT INTO employee_shift_assignments 
       (emp_code, assignment_date, shift_id, is_off_day, notes)
       VALUES (?, ?, ?, TRUE, 'Auto-generated off day')
       ON DUPLICATE KEY UPDATE 
       is_off_day = TRUE,
       shift_id = VALUES(shift_id)`,
      [empCode, dateStr, shiftId]
    );
  }

  private async tryResolveViolation(
    empCode: string,
    dateStr: string,
    shiftId: number,
    validation: ShiftValidationResult
  ): Promise<boolean> {
    // Simple resolution: if previous day is causing issue, try to make it an off day
    if (validation.prevShift && validation.restHours !== undefined && validation.requiredRestHours !== undefined) {
      if (validation.restHours < validation.requiredRestHours) {
        // Insert an off day before to give more rest
        await this.markOffDay(empCode, validation.prevShift.assignmentDate);
        return true;
      }
    }
    return false;
  }

  private async logRosterGeneration(
    templateId: number,
    monthYear: string,
    result: RosterGenerationResult,
    generatedBy: string
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO roster_generation_log 
       (generation_date, template_id, month_year, total_employees, total_assignments, 
        violations_found, violations_resolved, generated_by, notes)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        monthYear,
        result.assignmentsByEmployee.size,
        result.totalAssignments,
        result.violationsFound,
        result.violationsResolved,
        generatedBy,
        result.errors.length > 0 ? result.errors.join('; ') : 'Success'
      ]
    );
  }
}
