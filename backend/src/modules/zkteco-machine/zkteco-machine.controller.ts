import { Controller, Get, Post, Delete, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ZktecoMachineService, DeviceInfo } from './zkteco-machine.service';

@ApiTags('ZKTeco Machine')
@Controller('api/zkteco')
export class ZktecoMachineController {
  constructor(private readonly machineService: ZktecoMachineService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get device connection status' })
  async getStatus() {
    return this.machineService.getConnectionStatus();
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect from ZKTeco device' })
  async disconnect() {
    await this.machineService.disconnect();
    return {
      success: true,
      message: 'Disconnected from device',
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users registered on the device' })
  async getUsers() {
    try {
      const users = await this.machineService.getDeviceUsers();
      return {
        success: true,
        count: users.length,
        users,
      };
    } catch (error) {
      // Determine appropriate status code based on error message
      const isConnectionError = error.message?.toLowerCase().includes('connect') ||
                                error.message?.toLowerCase().includes('unable') ||
                                error.message?.toLowerCase().includes('network') ||
                                error.message?.toLowerCase().includes('timeout') ||
                                error.message?.toLowerCase().includes('unreachable');
      
      const statusCode = isConnectionError ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST;
      
      throw new HttpException(
        error.message || 'Failed to fetch device users',
        statusCode,
      );
    }
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Download attendance history from device' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  async getAttendance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const attendances = await this.machineService.getAttendanceHistory(startDate, endDate);
      return {
        success: true,
        count: attendances.length,
        attendances,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch attendance history',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sync-time')
  @ApiOperation({ summary: 'Synchronize device time with server' })
  async syncTime() {
    const success = await this.machineService.syncDeviceTime();
    return {
      success,
      message: success ? 'Device time synchronized' : 'Failed to sync device time',
    };
  }

  @Post('sync-users-to-db')
  @ApiOperation({ summary: 'Sync device users to employees database - creates employee records for all device users' })
  async syncUsersToDatabase() {
    try {
      const result = await this.machineService.syncDeviceUsersToDatabase();
      return result;
    } catch (error) {
      // Determine appropriate status code based on error message
      const isConnectionError = error.message?.toLowerCase().includes('connect') ||
                                error.message?.toLowerCase().includes('unable') ||
                                error.message?.toLowerCase().includes('network') ||
                                error.message?.toLowerCase().includes('timeout') ||
                                error.message?.toLowerCase().includes('unreachable');
      
      const statusCode = isConnectionError ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST;
      
      throw new HttpException(
        error.message || 'Failed to sync device users to database',
        statusCode,
      );
    }
  }

  @Get('diagnostics')
  @ApiOperation({ summary: 'Debug: Get raw device API responses to troubleshoot issues' })
  async getDiagnostics() {
    try {
      const diagnostics = await this.machineService.getDeviceDiagnostics();
      return {
        success: true,
        diagnostics,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get device diagnostics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sync-attendance-from-device')
  @ApiOperation({ summary: 'Fetch attendance from device (past 3 months) and save to database' })
  async syncAttendanceFromDevice() {
    try {
      const result = await this.machineService.syncAttendanceFromDevice();
      return result;
    } catch (error) {
      // Determine appropriate status code based on error message
      const errorMsg = error.message?.toLowerCase() || '';
      const isConnectionError = errorMsg.includes('connect') ||
                                errorMsg.includes('unable') ||
                                errorMsg.includes('network') ||
                                errorMsg.includes('timeout') ||
                                errorMsg.includes('unreachable');
      
      const isDeviceBusy = errorMsg.includes('timeout_on_writing') ||
                          errorMsg.includes('busy') ||
                          errorMsg.includes('econnrefused');
      
      let userMessage = error.message || 'Failed to sync attendance from device';
      let statusCode = HttpStatus.BAD_REQUEST;
      
      if (isDeviceBusy) {
        userMessage = 'Device is busy - another software (official ZKTeco app) is already connected. ' +
                     'Please close the official software first, then click Sync again. ' +
                     'Note: The device can only accept one connection at a time.';
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      } else if (isConnectionError) {
        userMessage = 'Cannot connect to ZKTeco device. ' +
                     'Please check: 1) Device is powered on, 2) Network cable connected, ' +
                     '3) IP address is correct, 4) Windows Firewall allows port 4370.';
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      }
      
      throw new HttpException(userMessage, statusCode);
    }
  }

}
