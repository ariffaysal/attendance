import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SetupDataService } from './setup-data.service';

@ApiTags('HRM - Setup Data Management')
@Controller('hrm/setup-data')
export class SetupDataController {
  constructor(private readonly service: SetupDataService) {}

  @Get()
  @ApiOperation({ summary: 'Get all setup data records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get setup data record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create setup data record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update setup data record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete setup data record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
