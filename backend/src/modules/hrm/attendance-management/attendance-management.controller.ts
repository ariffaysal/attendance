import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AttendanceManagementService } from './attendance-management.service';

@ApiTags('HRM - Attendance Management')
@Controller('hrm/attendance-management')
export class AttendanceManagementController {
  constructor(private readonly service: AttendanceManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all attendance management records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance management record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create attendance management record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update attendance management record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete attendance management record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
