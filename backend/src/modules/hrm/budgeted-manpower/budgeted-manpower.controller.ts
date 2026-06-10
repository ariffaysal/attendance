import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BudgetedManpowerService } from './budgeted-manpower.service';

@ApiTags('HRM - Budgeted Manpower')
@Controller('hrm/budgeted-manpower')
export class BudgetedManpowerController {
  constructor(private readonly service: BudgetedManpowerService) {}

  @Get()
  @ApiOperation({ summary: 'Get all budgeted manpower records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budgeted manpower record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create budgeted manpower record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update budgeted manpower record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete budgeted manpower record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
