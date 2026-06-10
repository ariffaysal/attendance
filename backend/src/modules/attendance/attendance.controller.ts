import { Controller, Post, Get, Query, Param, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AttendanceService } from './attendance.service';
import { SearchAttendanceDto } from './dto/search-attendance.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
  ) {}

  @Post('upload-csv')
  @ApiOperation({ summary: 'Upload monthly attendance CSV or Excel file when machine is offline' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `attendance-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
        return cb(new BadRequestException('Only CSV or Excel files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  }))
  async uploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    console.log(`[File Upload] Processing file: ${file.originalname}, size: ${file.size} bytes`);

    try {
      const result = await this.attendanceService.processUploadFile(file.path, file.originalname);
      return {
        success: true,
        message: `File processed successfully`,
        ...result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[File Upload] Error:`, error);
      throw new BadRequestException(`Failed to process file: ${errorMessage}`);
    }
  }

  @Get('records')
  @ApiOperation({ summary: 'Get attendance records with search and filter' })
  async getRecords(@Query() query: SearchAttendanceDto) {
    return this.attendanceService.getRecords(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get attendance statistics' })
  async getStats(@Query() query: SearchAttendanceDto) {
    return this.attendanceService.getStats(query);
  }

  @Get('job-cards')
  @ApiOperation({ summary: 'Get job card data for all employees' })
  async getJobCards(@Query() query: SearchAttendanceDto) {
    return this.attendanceService.getJobCards(query);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly attendance data' })
  async getMonthly(@Query() query: SearchAttendanceDto) {
    return this.attendanceService.getMonthlyData(query);
  }

  @Post('clear-data')
  @ApiOperation({ summary: 'Clear all attendance data (logs, real_time_logs, attendance tables)' })
  async clearData() {
    return this.attendanceService.clearAllData();
  }

  @Get('salary-attendance')
  @ApiOperation({ summary: 'Get attendance summary for salary sheet' })
  @ApiQuery({ name: 'fromDate', required: true, description: 'Start date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'toDate', required: true, description: 'End date in YYYY-MM-DD format' })
  async getSalaryAttendance(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.attendanceService.getSalaryAttendance(fromDate, toDate);
  }

  // ==========================================
  // CSV EMPLOYEES ENDPOINTS
  // ==========================================

  @Get('csv-employees')
  @ApiOperation({ summary: 'Get all unique employees from CSV uploads' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or employee code' })
  async getCsvEmployees(@Query('search') search?: string) {
    return this.attendanceService.getCsvEmployees(search);
  }

  @Get('csv-employees/ac-no/:acNo')
  @ApiOperation({ summary: 'Get a CSV employee by AC-No.' })
  async getCsvEmployeeByACNo(@Param('acNo') acNo: string) {
    return this.attendanceService.getCsvEmployeeByCode(acNo);
  }

  @Get('csv-employees/by-code/:empCode')
  @ApiOperation({ summary: 'Get a CSV employee by employee code (No.)' })
  async getCsvEmployeeByCode(@Param('empCode') empCode: string) {
    return this.attendanceService.getCsvEmployeeByCode(empCode);
  }

  @Get('csv-employees/lookup/:identifier')
  @ApiOperation({ summary: 'Lookup CSV employee by any identifier (Emp No., AC-No., No., or Name)' })
  async lookupCsvEmployee(@Param('identifier') identifier: string) {
    return this.attendanceService.lookupCsvEmployee(identifier);
  }

  @Post('remove-employee-data')
  @ApiOperation({ summary: 'Remove employee data (No., Name, Department) from employees table' })
  async removeEmployeeData(@Body() body: { acNos: string[] }) {
    return this.attendanceService.removeEmployeeData(body.acNos);
  }

  @Post('clear-logs')
  @ApiOperation({ summary: 'Clear all data from logs table before reupload' })
  async clearLogs() {
    return this.attendanceService.clearLogs();
  }

  @Post('sync-policy-to-logs')
  @ApiOperation({ summary: 'Sync shift_policy_rule from employee_policy_tagging to logs table' })
  async syncPolicyToLogs(@Body() body: { empCode?: string }) {
    return this.attendanceService.syncPolicyToLogs(body.empCode);
  }

  @Post('recalculate-late')
  @ApiOperation({ summary: 'Recalculate calculated_late for employee based on current shift_policy_rule' })
  async recalculateLate(@Body() body: { empCode: string }) {
    return this.attendanceService.recalculateAllLateForEmployee(body.empCode);
  }

}
