import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApprovalTrackingService } from './approval-tracking.service';

@ApiTags('HRM - Approval Tracking')
@Controller('hrm/approval-tracking')
export class ApprovalTrackingController {
  constructor(private readonly service: ApprovalTrackingService) {}

  @Get()
  @ApiOperation({ summary: 'Get all approval tracking records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval tracking record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create approval tracking record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update approval tracking record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete approval tracking record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
