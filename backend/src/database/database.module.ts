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
          console.log(`Connecting to MySQL Pool: ${host}:${port}/${database}`);
          
          // First connect without database to create it if needed
          const tempConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 5000 });
          await tempConn.execute(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          await tempConn.end();
          
          // Create a connection pool instead of a single connection
          const pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
          });
          
          console.log('MySQL Connection Pool initialized successfully');
          const connection = pool; // Use pool as the connection provider

          // Create logs table if it doesn't exist (keep existing data)
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
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
              \`calculated_late\` VARCHAR(10) DEFAULT '',
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
              \`Status\` VARCHAR(20),
              emp_id VARCHAR(50),
              gross_salary DECIMAL(10,2) DEFAULT NULL,
              basic_salary DECIMAL(10,2) DEFAULT NULL,
              policy_type ENUM('gross', 'basic', 'not_applicable') DEFAULT 'not_applicable',
              shift_code VARCHAR(50) DEFAULT NULL,
              shift_policy_rule VARCHAR(100) DEFAULT 'General shift (10 AM - 6 PM)',
              shift_start_time TIME DEFAULT NULL,
              shift_grace_minutes INT DEFAULT 15,
              late_minutes INT DEFAULT 0,
              calculated_late_minutes INT DEFAULT 0,
              actual_late DECIMAL(5,2) DEFAULT 0.00,
              late_deduction_rule VARCHAR(50) DEFAULT '5_late_1_absent',
              total_late_count INT DEFAULT 0,
              total_absent_from_late INT DEFAULT 0,
              actual_absent DECIMAL(5,2) DEFAULT 0.00,
              absent_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
              absent_deduction_policy VARCHAR(50) DEFAULT NULL,
              total_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
              late_count INT DEFAULT 0,
              late_deduction_days DECIMAL(5,2) DEFAULT 0.00,
              late_deduction_policy VARCHAR(50) DEFAULT NULL,
              day INT DEFAULT NULL,
              month INT DEFAULT NULL,
              year INT DEFAULT NULL,
              attendance_date DATE DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_ac_date (\`AC-No.\`, \`Date\`),
              INDEX idx_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          // Migration: Add missing columns if table already exists
          const columnsToMigrate = [
            { name: 'Status', type: 'VARCHAR(20)' },
            { name: 'emp_id', type: 'VARCHAR(50)' },
            { name: 'gross_salary', type: 'DECIMAL(10,2) DEFAULT NULL' },
            { name: 'basic_salary', type: 'DECIMAL(10,2) DEFAULT NULL' },
            { name: 'policy_type', type: "ENUM('gross', 'basic', 'not_applicable') DEFAULT 'not_applicable'" },
            { name: 'shift_code', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'shift_policy_rule', type: "VARCHAR(100) DEFAULT 'General shift (10 AM - 6 PM)'" },
            { name: 'shift_start_time', type: 'TIME DEFAULT NULL' },
            { name: 'shift_grace_minutes', type: 'INT DEFAULT 15' },
            { name: 'late_minutes', type: 'INT DEFAULT 0' },
            { name: 'calculated_late_minutes', type: 'INT DEFAULT 0' },
            { name: 'actual_late', type: 'DECIMAL(5,2) DEFAULT 0.00' },
            { name: 'late_deduction_rule', type: "VARCHAR(50) DEFAULT '5_late_1_absent'" },
            { name: 'total_late_count', type: 'INT DEFAULT 0' },
            { name: 'total_absent_from_late', type: 'INT DEFAULT 0' },
            { name: 'actual_absent', type: 'DECIMAL(5,2) DEFAULT 0.00' },
            { name: 'absent_deduction_amount', type: 'DECIMAL(10,2) DEFAULT 0.00' },
            { name: 'absent_deduction_policy', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'total_deduction_amount', type: 'DECIMAL(10,2) DEFAULT 0.00' },
            { name: 'late_count', type: 'INT DEFAULT 0' },
            { name: 'late_deduction_days', type: 'DECIMAL(5,2) DEFAULT 0.00' },
            { name: 'late_deduction_policy', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'day', type: 'INT DEFAULT NULL' },
            { name: 'month', type: 'INT DEFAULT NULL' },
            { name: 'year', type: 'INT DEFAULT NULL' },
            { name: 'attendance_date', type: 'DATE DEFAULT NULL' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
          ];

          for (const col of columnsToMigrate) {
            try {
              await connection.execute(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            } catch (err) {
              // Ignore if column already exists or other minor errors
            }
          }

          // Add unique constraint if missing
          try {
            await connection.execute(`ALTER TABLE logs ADD UNIQUE KEY IF NOT EXISTS unique_ac_date (\`AC-No.\`, \`Date\`)`);
          } catch (err) { }
          console.log('Logs table ready');

          // Create real_time_logs table for ZKTeco device punches and CSV imports
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS real_time_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
              device_user_id VARCHAR(50),
              emp_code VARCHAR(50),
              employee_name VARCHAR(200),
              punch_time DATETIME,
              verify_type VARCHAR(20),
              status VARCHAR(20) DEFAULT 'CheckIn',
              device_ip VARCHAR(20),
              processed TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`),
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
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
              emp_id VARCHAR(50) NOT NULL,
              day INT NOT NULL,
              month INT NOT NULL,
              year INT NOT NULL,
              status VARCHAR(10) DEFAULT 'A',
              in_time VARCHAR(10) DEFAULT '',
              out_time VARCHAR(10) DEFAULT '',
              late VARCHAR(10) DEFAULT '',
              ot VARCHAR(10) DEFAULT '',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_attendance (\`AC-No.\`, day, month, year),
              INDEX idx_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`),
              INDEX idx_emp_id (emp_id),
              INDEX idx_date (year, month, day)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Attendance table ready');

          // Create employee_addresses table
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_addresses (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
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
              UNIQUE KEY unique_ac_no (\`AC-No.\`),
              INDEX idx_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS csv_employees (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
              Department VARCHAR(100),
              policy_tagging_id INT NULL,
              is_active TINYINT(1) DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`),
              INDEX idx_department (Department),
              INDEX idx_policy (policy_tagging_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('CSV employees table ready');

          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_policy_tagging (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`Emp No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`AC-No.\` VARCHAR(50) NOT NULL,
              \`No.\` VARCHAR(50) NOT NULL DEFAULT '',
              \`Name\` VARCHAR(200) NOT NULL DEFAULT '',
              category VARCHAR(100) NULL,
              company VARCHAR(100) NULL,
              location VARCHAR(100) NULL,
              division VARCHAR(100) NULL,
              department VARCHAR(100) NULL,
              section VARCHAR(100) NULL,
              subsection VARCHAR(100) NULL,
              designation VARCHAR(100) NULL,
              overtime_policy_rule VARCHAR(50) NULL,
              absent_deduction_policy_rule VARCHAR(50) NULL,
              late_deduction_policy_rule VARCHAR(50) NULL,
              shift_policy_rule VARCHAR(50) NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_ac_no (\`AC-No.\`),
              INDEX idx_ac_no (\`AC-No.\`),
              INDEX idx_emp_no (\`Emp No.\`),
              INDEX idx_no (\`No.\`),
              INDEX idx_name (\`Name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Employee policy tagging table ready');

          await connection.execute(`
            CREATE TABLE IF NOT EXISTS shifts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_code VARCHAR(50) NOT NULL UNIQUE,
                shift_name VARCHAR(100) NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                grace_period_minutes INT DEFAULT 0,
                is_night_shift TINYINT(1) DEFAULT 0,
                description TEXT,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_shift_code (shift_code),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Shifts table ready');

          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_salary_information (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`AC-No.\` VARCHAR(50) NOT NULL,
              category VARCHAR(100) NULL,
              department VARCHAR(100) NULL,
              gross_salary VARCHAR(50) NULL,
              basic_salary VARCHAR(50) NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_ac_no (\`AC-No.\`),
              INDEX idx_ac_no (\`AC-No.\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Employee salary information table ready');

          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                \`AC-No.\` VARCHAR(50) NOT NULL,
                emp_code VARCHAR(50),
                status VARCHAR(20) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_ac_no (\`AC-No.\`),
                INDEX idx_ac_no (\`AC-No.\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('Employees master table ready');

          // Create employee_education table
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS employee_education (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`AC-No.\` VARCHAR(50) NOT NULL,
              category VARCHAR(100) NULL,
              company VARCHAR(100) NULL,
              location VARCHAR(100) NULL,
              division VARCHAR(100) NULL,
              department VARCHAR(100) NULL,
              section VARCHAR(100) NULL,
              subsection VARCHAR(100) NULL,
              designation VARCHAR(100) NULL,
              course_name VARCHAR(100) NULL,
              board VARCHAR(100) NULL,
              institution VARCHAR(200) NULL,
              discipline VARCHAR(100) NULL,
              major_subject VARCHAR(100) NULL,
              year VARCHAR(10) NULL,
              result VARCHAR(50) NULL,
              education_nature VARCHAR(50) DEFAULT 'Academic',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_ac_no (\`AC-No.\`),
              INDEX idx_ac_no (\`AC-No.\`)
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
              role ENUM('admin', 'staff', 'hr') DEFAULT 'staff',
              is_active TINYINT(1) DEFAULT 1,
              last_login TIMESTAMP NULL,
              reset_code VARCHAR(6) NULL,
              reset_code_expires TIMESTAMP NULL,
              is_reset_verified TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_employee_id (employee_id),
              INDEX idx_email (email),
              INDEX idx_reset_code (reset_code),
              INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          // Ensure existing auth_users tables support HR role and have the role column
          try {
            await connection.execute(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS role ENUM('admin', 'staff', 'hr') DEFAULT 'staff' AFTER password_hash`);
          } catch (err) {
            // ignore if column exists or MySQL version doesn't support IF NOT EXISTS
          }
          try {
            await connection.execute(`ALTER TABLE auth_users MODIFY COLUMN role ENUM('admin', 'staff', 'hr') DEFAULT 'staff'`);
          } catch (err) {
            // ignore if already matches or if modification is not needed
          }
          try {
            await connection.execute(`ALTER TABLE auth_users ADD INDEX idx_role (role)`);
          } catch (err) {
            // ignore if index already exists
          }
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
          const dbError = error as { message?: string; code?: string };
          console.error('❌ MySQL connection failed:', dbError.message ?? String(error));
          console.error('   Code:', dbError.code, '| Host:', host, '| Port:', port);
          throw error;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [SQL_CONNECTION],
})
export class DatabaseModule {}
