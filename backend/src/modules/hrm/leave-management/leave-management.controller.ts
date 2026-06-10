import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LeaveManagementService } from './leave-management.service';

@ApiTags('HRM - Leave Management')
@Controller('hrm/leave-management')
export class LeaveManagementController {
  constructor(private readonly service: LeaveManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all leave management records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave management record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create leave management record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update leave management record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete leave management record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
