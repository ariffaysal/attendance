import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentManagementService } from './payment-management.service';

@ApiTags('HRM - Payment Management')
@Controller('hrm/payment-management')
export class PaymentManagementController {
  constructor(private readonly service: PaymentManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all payment management records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment management record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create payment management record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payment management record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment management record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
