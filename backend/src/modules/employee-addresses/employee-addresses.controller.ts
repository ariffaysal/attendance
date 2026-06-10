import { Controller, Get, Post, Put, Delete, Body, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeeAddressesService } from './employee-addresses.service';
import { CreateEmployeeAddressDto, UpdateEmployeeAddressDto } from './dto/create-employee-address.dto';

@Controller('employee-addresses')
export class EmployeeAddressesController {
  constructor(private readonly employeeAddressesService: EmployeeAddressesService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.employeeAddressesService.findAll(search);
  }

  @Get('by-empcode/:empCode')
  async findByEmpCode(@Param('empCode') empCode: string) {
    const address = await this.employeeAddressesService.findByEmpCode(empCode);
    return address || null;
  }

  @Get('by-acno/:acNo')
  async findByACNo(@Param('acNo') acNo: string) {
    const address = await this.employeeAddressesService.findByACNo(acNo);
    return address || null;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.employeeAddressesService.findOne(Number(id));
  }

  @Post()
  async create(@Body() dto: CreateEmployeeAddressDto) {
    try {
      return await this.employeeAddressesService.create(dto);
    } catch (error: any) {
      console.error('Create employee address error:', error);
      throw new BadRequestException(error.message || 'Failed to create employee address');
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeAddressDto) {
    return this.employeeAddressesService.update(Number(id), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.employeeAddressesService.remove(Number(id));
    return { message: 'Employee address deleted successfully' };
  }
}
