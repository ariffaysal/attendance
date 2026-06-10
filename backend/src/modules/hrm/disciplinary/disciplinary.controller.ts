import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DisciplinaryService } from './disciplinary.service';

@ApiTags('HRM - Disciplinary')
@Controller('hrm/disciplinary')
export class DisciplinaryController {
  constructor(private readonly service: DisciplinaryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all disciplinary records' })
  @ApiResponse({ status: 200, description: 'Returns all records' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get disciplinary record by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create disciplinary record' })
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update disciplinary record' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete disciplinary record' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
