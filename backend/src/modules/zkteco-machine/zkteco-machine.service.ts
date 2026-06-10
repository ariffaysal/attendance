import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { AttendanceGateway } from './attendance.gateway';

// Dynamic import for zkteco-js to handle potential loading issues
let ZKLib: any;

try {
  ZKLib = require('zkteco-js');
} catch (e) {
  console.warn('⚠️ zkteco-js not available, running in mock mode');
}

export interface PunchData {
  userId: string;
  attTime: string;
  deviceId?: string;
  verifyType?: string;
  status?: string;
}

export interface DeviceInfo {
  ip: string;
  port: number;
  timeout: number;
  connected: boolean;
  lastError?: string;
}

@Injectable()
export class ZktecoMachineService implements OnModuleInit, OnModuleDestroy {
  private device: any = null;
  private isConnected = false;
  /** Coalesces overlapping connect attempts (reconnect timer + API calls). */
  private connectInFlight: Promise<boolean> | null = null;
  
  private readonly deviceIp: string;
  private readonly devicePort: number;
  private readonly connectionTimeout: number;

  constructor(
    @Inject(SQL_CONNECTION) private readonly db: mysql.Connection,
    private readonly configService: ConfigService,
    @Optional() private readonly attendanceGateway?: AttendanceGateway,
  ) {
    this.deviceIp = this.configService.get<string>('ZKTeco_IP') || '192.168.203.2';
    this.devicePort = parseInt(this.configService.get<string>('ZKTeco_PORT') || '4370');
    this.connectionTimeout = parseInt(this.configService.get<string>('ZKTeco_TIMEOUT') || '30000');
  }

  async onModuleInit() {
    console.log('[ZKTeco] Device connection disabled on startup. Connect only when syncing users.');
    console.log('[ZKTeco] Note: If official ZKTeco software is running, close it before syncing from this app.');
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * zkteco-js leaves a closed TCP socket on the same instance after failures; reusing it causes
   * ERR_STREAM_WRITE_AFTER_END. Always use a new ZKLib per attempt and coalesce concurrent connects.
   */
  async connectToMachine(): Promise<boolean> {
    if (!ZKLib) {
      console.warn('⚠️ zkteco-js SDK not available');
      return false;
    }

    if (this.isConnected && this.device) {
      console.log('[connectToMachine] Device already connected');
      return true;
    }

    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    this.connectInFlight = this.runConnectToMachine();
    try {
      return await this.connectInFlight;
    } finally {
      this.connectInFlight = null;
    }
  }

  private async disposeZkInstance(instance: any): Promise<void> {
    if (!instance) return;
    try {
      await Promise.race([
        instance.disconnect?.(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      /* ignore — disconnect often times out like CMD_CONNECT */
    }
  }

  private async runConnectToMachine(): Promise<boolean> {
    if (this.isConnected && this.device) {
      return true;
    }

    console.log(`[connectToMachine] 🔌 Connecting to ZKTeco device at ${this.deviceIp}:${this.devicePort}...`);

    try {
      if (this.device) {
        await this.disposeZkInstance(this.device);
        this.device = null;
      }

      // First, test basic TCP connectivity
      console.log('[connectToMachine] Testing basic TCP connectivity...');
      const net = require('net');
      const tcpTest = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        
        socket.on('connect', () => {
          console.log('[connectToMachine] ✅ Basic TCP connection successful');
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', (err: any) => {
          console.warn('[connectToMachine] Basic TCP test failed:', err.message);
          resolve(false);
        });
        
        socket.on('timeout', () => {
          console.warn('[connectToMachine] Basic TCP test timed out');
          socket.destroy();
          resolve(false);
        });
        
        socket.connect(this.devicePort, this.deviceIp);
      });
      
      if (!tcpTest) {
        console.error('[connectToMachine] Device is not reachable on TCP. Checking UDP...');
      }

      let lastError: unknown;

      // Use TCP only since UDP is disabled on device
      const connectionTypes = ['tcp'];
      console.log('[connectToMachine] Using TCP protocol');

      for (const connType of connectionTypes) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const zk = new ZKLib(this.deviceIp, this.devicePort, 30000, 5200, connType);
          console.log(
            `[connectToMachine] TCP Attempt ${attempt}/3 (timeout 30000 ms)`,
          );

          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            await zk.createSocket();
            this.device = zk;
            console.log(`[connectToMachine] ✅ Socket created successfully via TCP`);
            break;
          } catch (err) {
            lastError = err;
            console.warn(
              `[connectToMachine] Attempt ${attempt} with ${connType.toUpperCase()} failed:`,
              (err as Error)?.message || err,
            );
            await this.disposeZkInstance(zk);
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
        if (this.device) break;
      }
      
      if (!this.device) {
        console.log('[connectToMachine] TCP connection failed. Device may need manual reset or PC connection is disabled.');
      }

      if (!this.device) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Failed to connect after 3 attempts');
      }

      this.isConnected = true;
      console.log('[connectToMachine] ✅ Connected to ZKTeco device');
      
      // Test if device is actually responding by getting info
      try {
        console.log('[connectToMachine] Testing device response...');
        const deviceInfo = await this.device.getInfo();
        console.log('[connectToMachine] ✅ Device info:', deviceInfo);
        const userCount = await this.device.getUserCount();
        console.log('[connectToMachine] ✅ User count:', userCount);
      } catch (testErr) {
        console.warn('[connectToMachine] ⚠️ Could not get device info:', testErr.message);
      }

      if (this.attendanceGateway) {
        this.attendanceGateway.emitConnectionStatus({
          connected: true,
          deviceInfo: {
            ip: this.deviceIp,
            port: this.devicePort,
            timeout: this.connectionTimeout,
            connected: true,
          },
        });
      }

      return true;
    } catch (error) {
      this.isConnected = false;
      if (this.device) {
        await this.disposeZkInstance(this.device);
        this.device = null;
      }
      console.error('[connectToMachine] ❌ Machine Connection Error:', (error as Error)?.message || error || 'Unknown error');
      console.error('[ZKTeco] Connection failed. Manual retry required when syncing users.');
      return false;
    }
  }

  /**
   * Normalize date from device to MySQL datetime format
   * Handles Unix timestamps (seconds or milliseconds) and string dates
   */
  private normalizeDate(dateInput: any): string {
    if (!dateInput) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Check if it's a Unix timestamp (all digits)
    if (typeof dateInput === 'number' || /^\d+$/.test(dateInput.toString().trim())) {
      const num = parseInt(dateInput.toString(), 10);
      if (num > 946684800) { // Jan 1, 2000
        const ms = num > 1000000000000 ? num : num * 1000;
        return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    
    // Try parsing as standard date string
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  async disconnect(): Promise<void> {
    if (this.device && this.isConnected) {
      try {
        await this.device.disconnect();
        console.log('🔌 Disconnected from ZKTeco device');
      } catch (error) {
        console.error('Error disconnecting:', error.message);
      }
    }
    this.isConnected = false;
    this.device = null;
  }

  // Public API Methods

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      ip: this.deviceIp,
      port: this.devicePort,
      timeout: this.connectionTimeout,
      connected: this.isConnected,
    };
  }

  async getDeviceUsers(): Promise<any[]> {
    // Try to connect if not already connected
    if (!this.device || !this.isConnected) {
      console.log('[getDeviceUsers] Device not connected, attempting to connect...');
      const connected = await this.connectToMachine();
      if (!connected) {
        throw new Error(
          'Unable to connect to ZKTeco device. ' +
          'Please check device power, network connection, and IP configuration.'
        );
      }
    }

    try {
      console.log('[getDeviceUsers] Calling device.getUsers()...');
      const users = await this.device.getUsers();
      
      console.log('[getDeviceUsers] Raw response:', users);
      console.log('[getDeviceUsers] Type:', typeof users);
      console.log('[getDeviceUsers] Is Array:', Array.isArray(users));
      
      if (users && typeof users === 'object') {
        console.log('[getDeviceUsers] Keys:', Object.keys(users));
        
        // Check if it's wrapped in a data property
        if (users.data && Array.isArray(users.data)) {
          console.log('[getDeviceUsers] Found users.data array with', users.data.length, 'items');
          return users.data;
        }
        
        // Check if it's a single user object
        if (users.uid || users.userId) {
          console.log('[getDeviceUsers] Single user object found, wrapping in array');
          return [users];
        }
      }
      
      if (Array.isArray(users)) {
        console.log(`[getDeviceUsers] Array with ${users.length} users`);
        if (users.length > 0) {
          console.log('[getDeviceUsers] First user sample:', users[0]);
        }
        return users;
      }
      
      console.warn('[getDeviceUsers] Unexpected format, returning empty array');
      return [];
    } catch (error) {
      console.error('[getDeviceUsers] Error:', error.message);
      console.log('[getDeviceUsers] Trying fallback: extracting users from attendance history...');
      return this.extractUsersFromAttendanceHistory();
    }
  }

  /**
   * Fallback: Extract unique users from attendance history
   * Used when getUsers() API doesn't work properly
   */
  private async extractUsersFromAttendanceHistory(): Promise<any[]> {
    try {
      console.log('[extractUsersFromAttendanceHistory] Fetching attendance to extract unique users...');
      const attendances = await this.device.getAttendances();
      
      if (!attendances || !Array.isArray(attendances) || attendances.length === 0) {
        console.log('[extractUsersFromAttendanceHistory] No attendance data available');
        return [];
      }
      
      console.log(`[extractUsersFromAttendanceHistory] Got ${attendances.length} attendance records`);
      
      // Extract unique users from attendance data
      const userMap = new Map<string, any>();
      
      for (const record of attendances) {
        const userId = record.userId || record.uid || record.user_id || record.id;
        const userName = record.name || record.userName || record.employee || `User ${userId}`;
        
        if (userId && !userMap.has(userId.toString())) {
          userMap.set(userId.toString(), {
            uid: userId,
            userId: userId,
            name: userName,
            role: record.role || 0,
            password: record.password || '',
            card: record.card || 0,
          });
        }
      }
      
      const uniqueUsers = Array.from(userMap.values());
      console.log(`[extractUsersFromAttendanceHistory] Extracted ${uniqueUsers.length} unique users from attendance history`);
      
      if (uniqueUsers.length > 0) {
        console.log('[extractUsersFromAttendanceHistory] Sample user:', uniqueUsers[0]);
      }
      
      return uniqueUsers;
    } catch (error) {
      console.error('[extractUsersFromAttendanceHistory] Fallback failed:', error.message);
      return [];
    }
  }

  async getAttendanceHistory(startDate?: string, endDate?: string): Promise<any[]> {
    // Try to connect if not already connected
    if (!this.device || !this.isConnected) {
      console.log('[getAttendanceHistory] Device not connected, attempting to connect...');
      const connected = await this.connectToMachine();
      if (!connected) {
        throw new Error(
          'Unable to connect to ZKTeco device. ' +
          'Please check device power, network connection, and IP configuration.'
        );
      }
    }

    try {
      console.log('[Device] Fetching attendances from device...');
      let attendances;
      try {
        attendances = await this.device.getAttendances();
      } catch (fetchErr: any) {
        if (fetchErr.message?.includes('65535') || fetchErr.code === 'ERR_OUT_OF_RANGE') {
          console.error('[Device] Too many attendance records on device. The SDK cannot handle >65535 records.');
          throw new Error(
            'Device has too many attendance records (>65535). ' +
            'Please use ZKTeco Attendance Management software to download and backup records first, ' +
            'then clear device memory from the device menu: Comm -> Clear Attendance. ' +
            'This will NOT affect user information - only attendance logs will be cleared.'
          );
        }
        throw fetchErr;
      }
      
      console.log('[Device] Raw attendances:', attendances);
      console.log('[Device] Attendances type:', typeof attendances);
      console.log('[Device] Is array:', Array.isArray(attendances));
      
      // Handle different response formats
      let data = attendances;
      if (!data) {
        console.log('[Device] No attendances returned (null/undefined)');
        return [];
      }
      
      // Some SDKs return { data: [...] } or { attendances: [...] }
      if (!Array.isArray(data)) {
        if (data.data && Array.isArray(data.data)) {
          data = data.data;
        } else if (data.attendances && Array.isArray(data.attendances)) {
          data = data.attendances;
        } else {
          console.log('[Device] Unknown format, returning empty');
          return [];
        }
      }
      
      // Normalize timestamps in each record
      data = data.map((record: any) => {
        // Handle various timestamp formats from device
        let rawTime = record.attTime || record.time || record.timestamp || record.record_time || record.recordTime;
        if (rawTime) {
          record.attTime = this.normalizeDate(rawTime);
        }
        return record;
      });
      
      // Filter by date if provided
      if (startDate && endDate) {
        const filtered = data.filter((a: any) => {
          const attDate = a.attTime?.split(' ')[0] || a.time?.split(' ')[0] || a.date;
          return attDate >= startDate && attDate <= endDate;
        });
        console.log(`[Device] Filtered ${filtered.length} records from ${data.length} total`);
        return filtered;
      }
      
      console.log(`[Device] Returning ${data.length} records`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching attendance history:', error.message);
      return [];
    }
  }

  async syncDeviceTime(): Promise<boolean> {
    if (!this.device || !this.isConnected) {
      throw new Error('Device not connected');
    }

    try {
      await this.device.getTime();
      console.log('✅ Device time synchronized');
      return true;
    } catch (error) {
      console.error('Error syncing device time:', error.message);
      return false;
    }
  }

  async getConnectionStatus(): Promise<{ 
    connected: boolean; 
    deviceInfo: DeviceInfo;
    listenerActive?: boolean;
    connectionType?: string;
  }> {
    const deviceInfo = await this.getDeviceInfo();
    return {
      connected: this.isConnected,
      deviceInfo,
      listenerActive: this.isConnected, // If connected, listener should be active
      connectionType: (this.device as any)?.connectionType || 'unknown',
    };
  }

  /**
   * Diagnostic: Get raw device data to debug API issues
   */
  async getDeviceDiagnostics(): Promise<{
    connectionType: string | null;
    isConnected: boolean;
    usersRaw: any;
    attendancesRaw: any;
    deviceInfo: any;
  }> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const diagnostics = {
      connectionType: (this.device as any).connectionType,
      isConnected: this.isConnected,
      usersRaw: null as any,
      attendancesRaw: null as any,
      deviceInfo: null as any,
    };

    if (this.isConnected) {
      // Try getUsers
      try {
        console.log('[Diagnostics] Testing getUsers()...');
        const users = await this.device.getUsers();
        diagnostics.usersRaw = {
          type: typeof users,
          isArray: Array.isArray(users),
          length: Array.isArray(users) ? users.length : null,
          keys: users && typeof users === 'object' ? Object.keys(users) : null,
          sample: Array.isArray(users) && users.length > 0 ? users[0] : users,
        };
      } catch (err) {
        diagnostics.usersRaw = { error: err.message };
      }

      // Try getAttendances
      try {
        console.log('[Diagnostics] Testing getAttendances()...');
        const attendances = await this.device.getAttendances();
        diagnostics.attendancesRaw = {
          type: typeof attendances,
          isArray: Array.isArray(attendances),
          length: Array.isArray(attendances) ? attendances.length : null,
          keys: attendances && typeof attendances === 'object' ? Object.keys(attendances) : null,
          sample: Array.isArray(attendances) && attendances.length > 0 ? attendances[0] : attendances,
        };
      } catch (err) {
        diagnostics.attendancesRaw = { error: err.message };
      }

      // Try getInfo
      try {
        console.log('[Diagnostics] Testing getInfo()...');
        const info = await this.device.getInfo();
        diagnostics.deviceInfo = info;
      } catch (err) {
        diagnostics.deviceInfo = { error: err.message };
      }
    }

    return diagnostics;
  }

  /**
   * Test network connectivity to ZKTeco device
   */
  async testNetworkConnectivity(): Promise<{
    canPing: boolean;
    canConnect: boolean;
    portOpen: boolean;
    errors: string[];
    recommendations: string[];
  }> {
    const result = {
      canPing: false,
      canConnect: false,
      portOpen: false,
      errors: [] as string[],
      recommendations: [] as string[],
    };

    // Test 1: Check if we can create a socket (basic TCP connection)
    try {
      console.log('[NetworkTest] Testing basic TCP connection...');
      const net = require('net');
      
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          result.canConnect = true;
          result.portOpen = true;
          socket.destroy();
          resolve(true);
        });

        socket.on('error', (err: any) => {
          clearTimeout(timeout);
          result.errors.push(`Socket error: ${err.message}`);
          if (err.code === 'ECONNREFUSED') {
            result.recommendations.push('Device refused connection - check if device is powered on and connected to network');
          } else if (err.code === 'ETIMEDOUT') {
            result.recommendations.push('Connection timed out - check IP address and network connectivity');
          } else if (err.code === 'EHOSTUNREACH') {
            result.recommendations.push('Host unreachable - check network cables and IP configuration');
          }
          reject(err);
        });

        socket.connect(this.devicePort, this.deviceIp);
      });
    } catch (err) {
      console.error('[NetworkTest] TCP connection failed:', err.message);
    }

    // Test 2: Check Windows Firewall (if on Windows)
    if (process.platform === 'win32') {
      result.recommendations.push('Windows detected - ensure Windows Firewall allows port 4370');
      result.recommendations.push('Run as Administrator: netsh advfirewall firewall add rule name="ZKTeco" dir=in action=allow protocol=tcp localport=4370');
    }

    // Test 3: General recommendations
    if (!result.canConnect) {
      result.recommendations.push('Verify device IP matches configuration (currently: ' + this.deviceIp + ')');
      result.recommendations.push('Verify device port (currently: ' + this.devicePort + ')');
      result.recommendations.push('Try pinging device: ping ' + this.deviceIp);
      result.recommendations.push('Check device menu: Communication → Ethernet settings');
    }

    return result;
  }

  /**
   * Sync attendance from device to database
   * Fetches attendance records from the past 3 months + current month up to today
   * This avoids the 65535 record limit while providing historical attendance data
   */
  async syncAttendanceFromDevice(): Promise<{
    success: boolean;
    message: string;
    fetched: number;
    saved: number;
    dateRange: { from: string; to: string };
  }> {
    // Try to connect if not already connected
    if (!this.device || !this.isConnected) {
      console.log('[syncAttendanceFromDevice] Device not connected, attempting to connect...');
      const connected = await this.connectToMachine();
      if (!connected) {
        throw new Error(
          'Unable to connect to ZKTeco device. ' +
          'Please check: 1) Device is powered on, 2) Network cable is connected, ' +
          '3) IP address is correct (current: ' + this.deviceIp + '), ' +
          '4) Port 4370 is not blocked by firewall.'
        );
      }
    }

    try {
      // Calculate date range: previous 3 months + current month up to today
      const today = new Date();
      const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1); // 1st day of 3 months ago
      
      const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
      const toDate = today.toISOString().split('T')[0];
      
      console.log(`[syncAttendanceFromDevice] Fetching attendance from device for date range: ${fromDate} to ${toDate}`);
      
      // Fetch attendance from device
      let attendances: any[] = [];
      try {
        const result = await this.device.getAttendances();
        if (result && Array.isArray(result)) {
          attendances = result;
        } else if (result && result.data && Array.isArray(result.data)) {
          attendances = result.data;
        }
      } catch (attErr: any) {
        console.error('[syncAttendanceFromDevice] Error fetching attendances:', attErr.message);
        if (attErr.message?.includes('65535') || attErr.code === 'ERR_OUT_OF_RANGE') {
          throw new Error(
            'Device has too many attendance records (>65,535). ' +
            'Please use ZKTeco Attendance Management software to download and backup records first, ' +
            'then clear device memory from the device menu: Comm -> Clear Attendance. ' +
            'This will NOT affect user information - only attendance logs will be cleared.'
          );
        }
        throw attErr;
      }

      console.log(`[syncAttendanceFromDevice] Fetched ${attendances.length} total records from device`);

      if (!attendances || attendances.length === 0) {
        return {
          success: true,
          message: 'No attendance records found on device',
          fetched: 0,
          saved: 0,
          dateRange: { from: fromDate, to: toDate },
        };
      }

      // Filter for records within the date range (previous 3 months + current month)
      const filteredRecords = attendances.filter((record: any) => {
        const rawTime = record.record_time || record.recordTime || record.attTime || record.timestamp || record.time;
        if (!rawTime) return false;
        const recordDate = this.normalizeDate(rawTime).split(' ')[0];
        return recordDate >= fromDate && recordDate <= toDate;
      });

      console.log(`[syncAttendanceFromDevice] Found ${filteredRecords.length} records within date range (${fromDate} to ${toDate})`);

      // Save records to database
      let savedCount = 0;
      for (const record of filteredRecords) {
        try {
          const deviceUserId = record.user_id || record.userId || record.uid || record.id;
          const rawTime = record.record_time || record.recordTime || record.attTime || record.timestamp || record.time;
          const attTime = this.normalizeDate(rawTime);
          
          if (!deviceUserId || !attTime) {
            console.log('[syncAttendanceFromDevice] Skipping record with missing data:', record);
            continue;
          }

          // Check for duplicate
          const [existing] = await this.db.execute(
            `SELECT id FROM real_time_logs 
             WHERE device_user_id = ? AND punch_time = ?`,
            [deviceUserId.toString(), attTime]
          );

          if (existing && (existing as any[]).length > 0) {
            console.log(`[syncAttendanceFromDevice] Skipping duplicate: ${deviceUserId} at ${attTime}`);
            continue;
          }

          // Find employee info
          let empCode = null;
          let empName = 'Unknown';
          try {
            const [empRows] = await this.db.execute(
              `SELECT emp_code, full_name_english FROM employees WHERE emp_id = ? OR punch_card = ? LIMIT 1`,
              [deviceUserId.toString(), deviceUserId.toString()]
            );
            const emp = (empRows as any[])[0];
            if (emp) {
              empCode = emp.emp_code;
              empName = emp.full_name_english;
            }
          } catch (e) {
            // employees table might not exist
          }

          // Insert record
          await this.db.execute(
            `INSERT INTO real_time_logs 
             (device_user_id, emp_code, employee_name, punch_time, verify_type, status, device_ip) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              deviceUserId.toString(),
              empCode,
              empName,
              attTime,
              record.verifyType || record.verify || 'Fingerprint',
              'CheckIn',
              this.deviceIp
            ]
          );
          savedCount++;
          console.log(`[syncAttendanceFromDevice] Saved: ${empName} (${deviceUserId}) at ${attTime}`);
        } catch (saveErr: any) {
          console.error('[syncAttendanceFromDevice] Error saving record:', saveErr.message);
        }
      }

      const message = savedCount > 0 
        ? `Successfully synced ${savedCount} new attendance records from device (${fromDate} to ${toDate})`
        : filteredRecords.length > 0 
          ? `Found ${filteredRecords.length} records but all already exist in database`
          : `No attendance records found for date range (${fromDate} to ${toDate})`;

      return {
        success: true,
        message,
        fetched: filteredRecords.length,
        saved: savedCount,
        dateRange: { from: fromDate, to: toDate },
      };
    } catch (error: any) {
      console.error('[syncAttendanceFromDevice] Error:', error.message);
      throw new Error(`Failed to sync attendance from device: ${error.message}`);
    }
  }

  /**
   * Sync device users to employees database
   * This ensures all device users have corresponding employee records
   */
  async syncDeviceUsersToDatabase(): Promise<{
    success: boolean;
    message: string;
    totalDeviceUsers: number;
    newEmployees: number;
    updatedEmployees: number;
    failed: number;
    errors: string[];
  }> {
    // Try to connect if not already connected
    if (!this.device || !this.isConnected) {
      console.log('[syncDeviceUsersToDatabase] Device not connected, attempting to connect...');
      const connected = await this.connectToMachine();
      if (!connected) {
        throw new Error(
          'Unable to connect to ZKTeco device. ' +
          'Please check: 1) Device is powered on, 2) Network cable is connected, ' +
          '3) IP address is correct (current: ' + this.deviceIp + '), ' +
          '4) Port 4370 is not blocked by firewall. ' +
          'Click "Test Network" button to diagnose connectivity issues.'
        );
      }
    }

    try {
      console.log('📥 Fetching users from ZKTeco device...');
      let deviceUsers: any[] = [];
      
      try {
        deviceUsers = await this.getDeviceUsers();
      } catch (userErr: any) {
        console.error('[syncDeviceUsersToDatabase] Error getting users:', userErr.message);
        if (userErr.message?.includes('65535') || userErr.message?.includes('ERR_OUT_OF_RANGE')) {
          throw new Error(
            'Cannot sync users: Device has too many attendance records (>65,535). ' +
            'The SDK cannot read users when device memory is full. ' +
            'Options: 1) Use ZKTeco software to backup and clear device, or 2) Manually add employees to the database.'
          );
        }
        throw userErr;
      }
      
      if (!deviceUsers || deviceUsers.length === 0) {
        console.error('[syncDeviceUsersToDatabase] No users returned from device');
        throw new Error('No users found on device. Device may be empty or API format changed.');
      }

      console.log(`📊 Found ${deviceUsers.length} users on device`);

      let newEmployees = 0;
      let updatedEmployees = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const user of deviceUsers) {
        try {
          // Extract user data from device format
          const deviceUserId = user.uid || user.userId || user.id || user.user_id;
          const userName = user.name || user.userName || `User ${deviceUserId}`;
          
          if (!deviceUserId) {
            console.log('⚠️ Skipping user with no ID:', user);
            continue;
          }

          // Check if employee already exists with this device ID
          const [existing] = await this.db.execute(
            `SELECT id, emp_code, emp_id, punch_card, full_name_english 
             FROM employees 
             WHERE emp_id = ? OR punch_card = ? 
             LIMIT 1`,
            [deviceUserId.toString(), deviceUserId.toString()]
          );

          const existingEmployees = existing as any[];

          if (existingEmployees.length > 0) {
            // Update existing employee if name is empty or "Unknown"
            const emp = existingEmployees[0];
            if (!emp.full_name_english || emp.full_name_english === 'Unknown' || emp.full_name_english === '') {
              await this.db.execute(
                `UPDATE employees SET full_name_english = ? WHERE id = ?`,
                [userName, emp.id]
              );
              updatedEmployees++;
              console.log(`✅ Updated employee: ${userName} (ID: ${deviceUserId})`);
            } else {
              console.log(`ℹ️ Employee already exists: ${emp.full_name_english} (ID: ${deviceUserId})`);
            }
          } else {
            // Create new employee with device ID mapped
            const empCode = `EMP${String(deviceUserId).padStart(3, '0')}`;
            
            await this.db.execute(
              `INSERT INTO employees (
                emp_code, 
                emp_id, 
                full_name_english, 
                department, 
                designation, 
                status,
                national_id,
                mobile_no,
                company,
                location,
                joining_date,
                provisional_tenor
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                empCode,
                deviceUserId.toString(), // Maps device user ID to emp_id
                userName,
                'General', // Default department
                'Staff', // Default designation
                'Active',
                'N/A', // national_id placeholder
                'N/A', // mobile_no placeholder
                'Company', // Default company
                'Main', // Default location
                new Date().toISOString().split('T')[0], // today's date as joining
                'Permanent' // Default tenor
              ]
            );
            newEmployees++;
            console.log(`✅ Created new employee: ${userName} (ID: ${deviceUserId})`);
          }
        } catch (userError) {
          failed++;
          const errorMsg = `Failed to process user ${user.uid || user.userId}: ${userError.message}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      const message = `Sync complete: ${newEmployees} new, ${updatedEmployees} updated, ${failed} failed out of ${deviceUsers.length} device users`;
      console.log(message);

      return {
        success: true,
        message,
        totalDeviceUsers: deviceUsers.length,
        newEmployees,
        updatedEmployees,
        failed,
        errors,
      };
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      throw new Error(`Failed to sync device users: ${error.message}`);
    }
  }
}
