import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all employees with optional search' })
  async getAll(@Query('search') search?: string) {
    return this.employeesService.findAll(search);
  }

  @Get('search/suggestions')
  @ApiOperation({ summary: 'Get employee search suggestions for autocomplete' })
  async getSearchSuggestions(@Query('q') query?: string, @Query('limit') limit?: number, @Query('searchType') searchType?: string) {
    return this.employeesService.getSearchSuggestions(query, limit || 10, searchType);
  }

  @Get('validate/:empCode')
  @ApiOperation({ summary: 'Validate if employee code exists and return employee data' })
  async validateEmployee(@Param('empCode') empCode: string) {
    const employee = await this.employeesService.findByEmpCode(empCode);
    if (!employee) {
      return { valid: false, employee: null };
    }
    return { valid: true, employee };
  }

  @Get('lookup/:identifier')
  @ApiOperation({ summary: 'Lookup employee by code, ID, or name' })
  async lookupEmployee(@Param('identifier') identifier: string) {
    const employee = await this.employeesService.lookupEmployee(identifier);
    if (!employee) {
      throw new NotFoundException(`Employee not found for identifier: '${identifier}'`);
    }
    return employee;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new employee' })
  @ApiBody({ type: CreateEmployeeDto })
  async create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update employee' })
  @ApiBody({ type: UpdateEmployeeDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete employee' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.delete(id);
  }
}
