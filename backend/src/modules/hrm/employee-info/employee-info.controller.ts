import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeInfoService } from './employee-info.service';

@ApiTags('HRM - Employee Information')
@Controller('hrm/employee-info')
export class EmployeeInfoController {
  constructor(private readonly service: EmployeeInfoService) {}

  @Get()
  @ApiOperation({ summary: 'Get all HRM employee info records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get HRM employee info record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create HRM employee info record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update HRM employee info record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete HRM employee info record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
