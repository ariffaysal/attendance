import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DutyRosterService, ShiftValidationResult } from './duty-roster.service';

@ApiTags('HRM - Shift & Roster Management')
@Controller('hrm/shifts')
export class ShiftController {
  constructor(private readonly dutyRosterService: DutyRosterService) {}

  // ============ SHIFTS ============

  @Get()
  @ApiOperation({ summary: 'Get all active shifts' })
  @ApiResponse({ status: 200, description: 'Returns all shifts' })
  async getAllShifts() {
    const shifts = await this.dutyRosterService.getAllShifts();
    return { success: true, data: shifts };
  }

  @Get('options')
  @ApiOperation({ summary: 'Get shift options for dropdown' })
  @ApiResponse({ status: 200, description: 'Returns shift options formatted for dropdown' })
  async getShiftOptions() {
    const options = await this.dutyRosterService.getShiftOptions();
    return { success: true, data: options };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shift by ID' })
  @ApiResponse({ status: 200, description: 'Returns shift details' })
  async getShiftById(@Param('id') id: string) {
    const shift = await this.dutyRosterService.getShiftById(parseInt(id));
    if (!shift) {
      return { success: false, error: 'Shift not found' };
    }
    return { success: true, data: shift };
  }

  // ============ SHIFT ASSIGNMENTS ============

  @Post('assign')
  @ApiOperation({ summary: 'Assign shift to employee for a specific date' })
  @ApiResponse({ status: 200, description: 'Shift assigned successfully' })
  async assignShift(@Body() dto: {
    empCode: string;
    assignmentDate: string;
    shiftId: number;
    notes?: string;
    createdBy?: string;
    skipValidation?: boolean;
  }) {
    const result = await this.dutyRosterService.assignShift({
      empCode: dto.empCode,
      assignmentDate: dto.assignmentDate,
      shiftId: dto.shiftId,
      notes: dto.notes,
      createdBy: dto.createdBy
    }, !dto.skipValidation);
    
    return result;
  }

  @Post('assign/bulk')
  @ApiOperation({ summary: 'Bulk assign shifts for date range' })
  @ApiResponse({ status: 200, description: 'Shifts assigned in bulk' })
  async bulkAssignShifts(@Body() dto: {
    empCodes: string[];
    startDate: string;
    endDate: string;
    shiftId: number;
    skipWeekends?: boolean;
    skipHolidays?: boolean;
  }) {
    return await this.dutyRosterService.bulkAssignShifts(dto);
  }

  @Get('calendar/:empCode')
  @ApiOperation({ summary: 'Get employee shift calendar for date range' })
  @ApiResponse({ status: 200, description: 'Returns shift calendar' })
  async getEmployeeShiftCalendar(
    @Param('empCode') empCode: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string
  ) {
    if (!fromDate || !toDate) {
      return { success: false, error: 'fromDate and toDate are required' };
    }
    const calendar = await this.dutyRosterService.getEmployeeShiftCalendar(empCode, fromDate, toDate);
    return { success: true, data: calendar };
  }

  @Delete('assignment/:id')
  @ApiOperation({ summary: 'Delete shift assignment' })
  @ApiResponse({ status: 200, description: 'Assignment deleted' })
  async deleteAssignment(@Param('id') id: string) {
    const success = await this.dutyRosterService.deleteAssignment(parseInt(id));
    return { success };
  }

  // ============ VALIDATION ============

  @Post('validate')
  @ApiOperation({ summary: 'Validate shift assignment without saving' })
  @ApiResponse({ status: 200, description: 'Returns validation result' })
  async validateAssignment(@Body() dto: {
    empCode: string;
    shiftId: number;
    assignmentDate: string;
  }): Promise<ShiftValidationResult> {
    return await this.dutyRosterService.validateShiftAssignment(
      dto.empCode,
      dto.shiftId,
      dto.assignmentDate,
      true
    );
  }

  // ============ ROSTER TEMPLATES ============

  @Get('roster/templates')
  @ApiOperation({ summary: 'Get all roster templates' })
  @ApiResponse({ status: 200, description: 'Returns all templates' })
  async getRosterTemplates() {
    const templates = await this.dutyRosterService.getRosterTemplates();
    return { success: true, data: templates };
  }

  @Post('roster/generate')
  @ApiOperation({ summary: 'Generate roster from template' })
  @ApiResponse({ status: 200, description: 'Roster generated' })
  async generateRoster(@Body() dto: {
    templateId: number;
    monthYear: string;
    empCodes: string[] | 'ALL';
    generatedBy?: string;
  }) {
    return await this.dutyRosterService.generateRosterFromTemplate(
      dto.templateId,
      dto.monthYear,
      dto.empCodes,
      dto.generatedBy
    );
  }

  // ============ VIOLATIONS ============

  @Get('roster/violations')
  @ApiOperation({ summary: 'Get roster violations in date range' })
  @ApiResponse({ status: 200, description: 'Returns violations' })
  async getViolations(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string
  ) {
    if (!fromDate || !toDate) {
      return { success: false, error: 'fromDate and toDate are required' };
    }
    const violations = await this.dutyRosterService.getViolations(fromDate, toDate);
    return { success: true, data: violations };
  }

  // ============ EMPLOYEE SHIFT INFO ============

  @Get('employee/:empCode/current')
  @ApiOperation({ summary: 'Get current shift for employee' })
  @ApiResponse({ status: 200, description: 'Returns current shift' })
  async getEmployeeCurrentShift(@Param('empCode') empCode: string) {
    const today = new Date().toISOString().split('T')[0];
    const shift = await this.dutyRosterService.getEmployeeShift(empCode, today);
    return { 
      success: true, 
      data: shift,
      date: today
    };
  }

  @Get('employee/:empCode/on-date')
  @ApiOperation({ summary: 'Get shift for employee on specific date' })
  @ApiResponse({ status: 200, description: 'Returns shift for date' })
  async getEmployeeShiftOnDate(
    @Param('empCode') empCode: string,
    @Query('date') date: string
  ) {
    if (!date) {
      return { success: false, error: 'date is required' };
    }
    const shift = await this.dutyRosterService.getEmployeeShift(empCode, date);
    return { success: true, data: shift, date };
  }
}
