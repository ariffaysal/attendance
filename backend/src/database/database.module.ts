import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

export const SQL_CONNECTION = 'SQL_CONNECTION';

@Module({
  providers: [
    {
      provide: SQL_CONNECTION,
      useFactory: async (configService: ConfigService): Promise<mysql.Connection> => {
        // MySQL connection for XAMPP
        const host = configService.get<string>('DB_HOST') || 'localhost';
        const port = parseInt(configService.get<string>('DB_PORT') || '3306');
        const database = configService.get<string>('DB_NAME') || 'attendance_db';
        const user = configService.get<string>('DB_USER') || 'root';
        const password = configService.get<string>('DB_PASSWORD') || '';

        try {
          console.log(`Connecting to MySQL: ${host}:${port}/${database}`);
          
          // First connect without database to create it if needed
          const tempConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 5000 });
          await tempConn.execute(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          await tempConn.end();
          
          // Now connect to the database
          const connection = await mysql.createConnection({
            host, port, user, password, database, connectTimeout: 10000,
          });
          console.log('Connected to MySQL successfully');

          // Create logs table if it doesn't exist (keep existing data)
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50),
              \`AC-No.\` VARCHAR(50),
              \`No.\` VARCHAR(50),
              \`Name\` VARCHAR(200),
              \`Auto-Assign\` VARCHAR(50),
              \`Date\` VARCHAR(20),
              \`Timetable\` VARCHAR(50),
              \`On duty\` VARCHAR(10),
              \`Off duty\` VARCHAR(10),
              \`Clock In\` VARCHAR(10),
              \`Clock Out\` VARCHAR(10),
              \`Normal\` VARCHAR(10),
              \`Real time\` VARCHAR(10),
              \`Late\` VARCHAR(10),
              \`Early\` VARCHAR(10),
              \`Absent\` VARCHAR(10),
              \`OT Time\` VARCHAR(10),
              \`Work Time\` VARCHAR(10),
              \`Exception\` VARCHAR(100),
              \`Must C/In\` VARCHAR(10),
              \`Must C/Out\` VARCHAR(10),
              \`Department\` VARCHAR(100),
              \`NDays\` VARCHAR(10),
              \`WeekEnd\` VARCHAR(10),
              \`Holiday\` VARCHAR(10),
              \`ATT_Time\` VARCHAR(10),
              \`NDays_OT\` VARCHAR(10),
              \`WeekEnd_OT\` VARCHAR(10),
              \`Holiday_OT\` VARCHAR(10),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Logs table ready');

          // Create real_time_logs table for ZKTeco device punches
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS real_time_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              device_user_id VARCHAR(50) NOT NULL,
              emp_code VARCHAR(50),
              employee_name VARCHAR(200),
              punch_time DATETIME NOT NULL,
              verify_type VARCHAR(20),
              status VARCHAR(20) DEFAULT 'CheckIn',
              device_ip VARCHAR(20),
              processed TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_device_user_id (device_user_id),
              INDEX idx_punch_time (punch_time),
              INDEX idx_processed (processed)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Real-time logs table ready');

          // Create attendance table for synced daily records
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS attendance (
              id INT AUTO_INCREMENT PRIMARY KEY,
              emp_id VARCHAR(50) NOT NULL,
              day INT NOT NULL,
              month INT NOT NULL,
              year INT NOT NULL,
              status VARCHAR(10) DEFAULT 'A',
              in_time VARCHAR(10) DEFAULT '',
              out_time VARCHAR(10) DEFAULT '',
              ot VARCHAR(10) DEFAULT '',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_attendance (emp_id, day, month, year),
              INDEX idx_emp_id (emp_id),
              INDEX idx_date (year, month, day)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Attendance table ready');

          // Create employee_addresses table if it doesn't exist
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_addresses (
              id INT AUTO_INCREMENT PRIMARY KEY,
              emp_code VARCHAR(50) NOT NULL,
              category VARCHAR(50),
              company VARCHAR(100),
              location VARCHAR(100),
              division_org VARCHAR(100),
              department VARCHAR(100),
              section VARCHAR(100),
              subsection VARCHAR(100),
              designation VARCHAR(100),
              present_village_area VARCHAR(200),
              present_house_no VARCHAR(50),
              present_road_no VARCHAR(50),
              present_post_office_code VARCHAR(20),
              present_thana VARCHAR(100),
              present_district VARCHAR(100),
              present_division_geo VARCHAR(100),
              present_land_phone VARCHAR(20),
              present_cell_phone VARCHAR(20),
              present_email VARCHAR(100),
              is_same_as_present TINYINT(1) DEFAULT 0,
              permanent_village_area VARCHAR(200),
              permanent_house_no VARCHAR(50),
              permanent_road_no VARCHAR(50),
              permanent_post_office_code VARCHAR(20),
              permanent_thana VARCHAR(100),
              permanent_district VARCHAR(100),
              permanent_division_geo VARCHAR(100),
              permanent_land_phone VARCHAR(20),
              permanent_cell_phone VARCHAR(20),
              permanent_email VARCHAR(100),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_emp_code (emp_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          // Create employee_education table if it doesn't exist
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_education (
              id INT AUTO_INCREMENT PRIMARY KEY,
              emp_code VARCHAR(50) NOT NULL,
              emp_id VARCHAR(50),
              emp_name VARCHAR(100),
              category VARCHAR(100),
              company VARCHAR(100),
              location VARCHAR(100),
              division VARCHAR(100),
              department VARCHAR(100),
              section VARCHAR(100),
              subsection VARCHAR(100),
              designation VARCHAR(100),
              course_name VARCHAR(100),
              board VARCHAR(100),
              institution VARCHAR(200),
              discipline VARCHAR(100),
              major_subject VARCHAR(100),
              year VARCHAR(10),
              result VARCHAR(50),
              education_nature VARCHAR(50) DEFAULT 'Academic',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_emp_code (emp_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Employee education table ready');

          // Create auth_users table for authentication
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS auth_users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              employee_id VARCHAR(50) NOT NULL UNIQUE,
              email VARCHAR(100) NOT NULL UNIQUE,
              mobile_number VARCHAR(20) NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              is_active TINYINT(1) DEFAULT 1,
              last_login TIMESTAMP NULL,
              reset_code VARCHAR(6) NULL,
              reset_code_expires TIMESTAMP NULL,
              is_reset_verified TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_employee_id (employee_id),
              INDEX idx_email (email),
              INDEX idx_reset_code (reset_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Auth users table ready');

          // Add MSSQL-style request() method for attendance service compatibility
          (connection as any).request = function() {
            const inputs: Record<string, any> = {};
            return {
              input(name: string, type: any, value: any) {
                inputs[name] = value;
                return this;
              },
              async query(sql: string) {
                // Replace ? placeholders with actual values from inputs
                let finalSql = sql;
                let paramIndex = 0;
                const values: any[] = [];
                
                // Extract values from inputs in order they appear in SQL
                for (const key of Object.keys(inputs)) {
                  values.push(inputs[key]);
                }
                
                const [result] = await connection.execute(finalSql, values);
                return { recordset: result, rowsAffected: [(result as any).affectedRows || 0] };
              }
            };
          };
          
          return connection;
        } catch (error) {
          console.error('❌ MySQL connection failed:', error.message);
          console.error('   Code:', error.code, '| Host:', host, '| Port:', port);
          throw error;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [SQL_CONNECTION],
})
export class DatabaseModule {}
