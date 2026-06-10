import { Controller, Post, Get, Query, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AttendanceService } from './attendance.service';
import { SearchAttendanceDto } from './dto/search-attendance.dto';
import { ZktecoMachineService } from '../zkteco-machine/zkteco-machine.service';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly zktecoService: ZktecoMachineService,
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync real-time logs to attendance table' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End date (YYYY-MM-DD)' })
  async syncAttendance(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    console.log(`[Sync] fromDate: ${fromDate}, toDate: ${toDate}`);
    try {
      const result = await this.attendanceService.syncRealtimeToAttendance(fromDate, toDate);
      console.log(`[Sync] Result:`, result);
      return result;
    } catch (error) {
      console.error(`[Sync] Error:`, error);
      throw error;
    }
  }

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
      console.error(`[File Upload] Error:`, error);
      throw new BadRequestException(`Failed to process file: ${error.message}`);
    }
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's real-time punches" })
  async getTodayPunches() {
    return this.attendanceService.getTodayPunches();
  }

  @Post('test-punch')
  @ApiOperation({ summary: 'Create a test punch (for debugging)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'name', required: false })
  async createTestPunch(
    @Query('userId') userId?: string,
    @Query('name') name?: string,
  ) {
    return this.attendanceService.createTestPunch(userId || '101', name || 'Test User');
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

  @Get('users')
  @ApiOperation({ summary: 'Get all users/employees from database' })
  async getUsers() {
    return this.attendanceService.getAllUsers();
  }

  @Post('clear-data')
  @ApiOperation({ summary: 'Clear all attendance data (logs, real_time_logs, attendance tables)' })
  async clearData() {
    return this.attendanceService.clearAllData();
  }

  @Get('salary-attendance')
  @ApiOperation({ summary: 'Get attendance summary for salary sheet' })
  @ApiQuery({ name: 'month', required: true, description: 'Month in YYYY-MM format' })
  async getSalaryAttendance(@Query('month') month: string) {
    return this.attendanceService.getSalaryAttendance(month);
  }

}
