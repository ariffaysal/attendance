import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { LibraryService } from './library.service';
import { RuleEngineService } from './rule-engine.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/create-policy.dto';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';
import { 
  CreatePolicyAssignmentDto, 
  UpdatePolicyAssignmentDto, 
  BulkAssignDto,
  EmployeePolicyQueryDto 
} from './dto/policy-assignment.dto';
import { EvaluateRuleDto, TestRuleConditionDto } from './dto/evaluate-rule.dto';

@Controller('library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly ruleEngineService: RuleEngineService,
  ) {}

  // ==========================================
  // POLICIES
  // ==========================================

  @Get('policies')
  async getAllPolicies(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.getAllPolicies({
      search,
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('policies/categories')
  async getPolicyCategories() {
    return this.libraryService.getPolicyCategories();
  }

  @Get('policies/active-with-rules')
  async getActivePoliciesWithRules() {
    return this.libraryService.getActivePoliciesWithRules();
  }

  @Get('policies/:id')
  async getPolicyById(@Param('id') id: string) {
    return this.libraryService.getPolicyById(parseInt(id));
  }

  @Get('policies/:id/impact')
  async getPolicyImpact(@Param('id') id: string) {
    return this.libraryService.getPolicyImpactAnalysis(parseInt(id));
  }

  @Post('policies')
  @UsePipes(new ValidationPipe({ transform: true }))
  async createPolicy(@Body() data: CreatePolicyDto) {
    return this.libraryService.createPolicy(data);
  }

  @Put('policies/:id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updatePolicy(@Param('id') id: string, @Body() data: UpdatePolicyDto) {
    return this.libraryService.updatePolicy(parseInt(id), data);
  }

  @Post('policies/:id/duplicate')
  async duplicatePolicy(@Param('id') id: string) {
    return this.libraryService.duplicatePolicy(parseInt(id));
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    return this.libraryService.deletePolicy(parseInt(id));
  }

  // ==========================================
  // POLICY RULES
  // ==========================================

  @Get('policies/:policyId/rules')
  async getRulesByPolicy(@Param('policyId') policyId: string) {
    return this.libraryService.getRulesByPolicy(parseInt(policyId));
  }

  @Post('policies/:policyId/rules')
  @UsePipes(new ValidationPipe({ transform: true }))
  async createRule(
    @Param('policyId') policyId: string,
    @Body() data: CreateRuleDto,
  ) {
    return this.libraryService.createRule(parseInt(policyId), data);
  }

  @Put('rules/:ruleId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() data: UpdateRuleDto,
  ) {
    console.log('[DEBUG] Controller updateRule:', { ruleId, data });
    try {
      const result = await this.libraryService.updateRule(parseInt(ruleId), data);
      console.log('[DEBUG] Update successful:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DEBUG] Update failed:', errorMessage);
      throw error;
    }
  }

  @Delete('rules/:ruleId')
  async deleteRule(@Param('ruleId') ruleId: string) {
    return this.libraryService.deleteRule(parseInt(ruleId));
  }

  // ==========================================
  // RULE ENGINE - CONDITION EVALUATION
  // ==========================================

  @Get('rule-engine/fields')
  async getAvailableFields() {
    return {
      fields: this.ruleEngineService.getAvailableFields(),
      operators: this.ruleEngineService.getAvailableOperators(),
    };
  }

  @Post('rules/evaluate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async evaluateRule(@Body() dto: EvaluateRuleDto) {
    const result = await this.ruleEngineService.evaluateRule(
      dto.rule_id,
      dto.employee_context,
    );
    return result;
  }

  @Post('policies/:policyId/evaluate-rules')
  async evaluatePolicyRules(
    @Param('policyId') policyId: string,
    @Body() dto: { employee_context: any },
  ) {
    const results = await this.ruleEngineService.evaluatePolicyRules(
      parseInt(policyId),
      dto.employee_context,
    );
    return {
      policy_id: parseInt(policyId),
      total_rules: results.length,
      matched_rules: results.filter(r => r.matched).length,
      results,
    };
  }

  @Post('rules/:ruleId/test')
  @UsePipes(new ValidationPipe({ transform: true }))
  async testRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: TestRuleConditionDto,
  ) {
    return this.ruleEngineService.testRule(
      parseInt(ruleId),
      dto.test_data as any,
      true,
      dto.test_name || `Test-${Date.now()}`,
    );
  }

  @Post('rules/validate-conditions')
  async validateConditions(@Body() dto: { conditions: any }) {
    return this.ruleEngineService.validateConditions(dto.conditions);
  }

  // ==========================================
  // POLICY ASSIGNMENTS (DYNAMIC)
  // ==========================================

  @Get('assignments')
  async getPolicyAssignments(
    @Query('emp_code') empCode?: string,
    @Query('policy_id') policyId?: string,
    @Query('department') department?: string,
    @Query('is_active') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.getPolicyAssignments({
      empCode,
      policyId: policyId ? parseInt(policyId) : undefined,
      department,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('employees/:empCode/policies')
  async getEmployeePolicies(@Param('empCode') empCode: string) {
    return this.libraryService.getEmployeePolicies(empCode);
  }

  @Post('assignments')
  @UsePipes(new ValidationPipe({ transform: true }))
  async createAssignment(@Body() dto: CreatePolicyAssignmentDto) {
    return this.libraryService.createPolicyAssignment(dto);
  }

  @Put('assignments/:id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyAssignmentDto,
  ) {
    return this.libraryService.updatePolicyAssignment(parseInt(id), dto);
  }

  @Delete('assignments/:id')
  async deleteAssignment(@Param('id') id: string) {
    return this.libraryService.deletePolicyAssignment(parseInt(id));
  }

  @Post('assignments/bulk')
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkAssign(@Body() dto: BulkAssignDto) {
    return this.libraryService.bulkAssignPolicies(dto);
  }

  @Post('assignments/copy')
  async copyAssignments(
    @Body() dto: { from_emp_code: string; to_emp_codes: string[] },
  ) {
    return this.libraryService.copyPolicyAssignments(dto.from_emp_code, dto.to_emp_codes);
  }

  // ==========================================
  // POLICY TEMPLATES
  // ==========================================

  @Get('templates')
  async getPolicyTemplates() {
    return this.libraryService.getPolicyTemplates();
  }

  @Post('policies/:id/create-from-template')
  async createFromTemplate(
    @Param('id') templateId: string,
    @Body() dto: { policy_code: string; policy_name: string },
  ) {
    return this.libraryService.createPolicyFromTemplate(
      parseInt(templateId),
      dto.policy_code,
      dto.policy_name,
    );
  }
}
