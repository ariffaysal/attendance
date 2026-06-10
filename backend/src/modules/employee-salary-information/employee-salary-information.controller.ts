import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { EmployeeSalaryInformationService } from './employee-salary-information.service';
import { CreateEmployeeSalaryInformationDto, UpdateEmployeeSalaryInformationDto, SalaryDeductionsDto } from './dto/create-employee-salary-information.dto';

@Controller('employee-salary-information')
export class EmployeeSalaryInformationController {
  constructor(private readonly employeeSalaryInformationService: EmployeeSalaryInformationService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('searchType') searchType?: 'name' | 'acc_no'
  ) {
    return this.employeeSalaryInformationService.findAll(search, searchType);
  }

  @Get('by-empcode/:empCode')
  async findByEmpCode(@Param('empCode') empCode: string) {
    return this.employeeSalaryInformationService.findByEmpCode(empCode);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.employeeSalaryInformationService.findOne(Number(id));
  }

  @Post()
  async create(@Body() dto: CreateEmployeeSalaryInformationDto) {
    return this.employeeSalaryInformationService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeSalaryInformationDto) {
    return this.employeeSalaryInformationService.update(Number(id), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.employeeSalaryInformationService.remove(Number(id));
    return { message: 'Employee salary information deleted successfully' };
  }

  @Post('update-deductions')
  async updateDeductions(@Body() dto: SalaryDeductionsDto) {
    await this.employeeSalaryInformationService.updateSalaryDeductions(dto.empCode, {
      absentAmount: dto.absentAmount,
      lateDeduct: dto.lateDeduct,
      totalDeductions: dto.totalDeductions,
      finalPayable: dto.finalPayable
    });
    return { message: 'Deductions updated successfully' };
  }
}
