import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PendingListService } from './pending-list.service';

@ApiTags('HRM - Pending List')
@Controller('hrm/pending-list')
export class PendingListController {
  constructor(private readonly service: PendingListService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pending list records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pending list record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create pending list record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update pending list record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pending list record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
