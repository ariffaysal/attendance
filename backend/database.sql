-- ============================================
-- Attendance System Database Schema
-- Database: attendance_db
-- Single Identity: AC-No.
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE attendance_db;

-- ============================================
-- 1. Shifts - Work shift definitions
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_code VARCHAR(50) NOT NULL UNIQUE,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT DEFAULT 0,
    is_night_shift TINYINT(1) DEFAULT 0,
    max_consecutive_days INT DEFAULT 5,
    rest_hours_required INT DEFAULT 8,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shift_code (shift_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO shifts (shift_code, shift_name, start_time, end_time, grace_period_minutes, is_night_shift, description) VALUES
('MORNING', 'Morning Shift', '08:00:00', '16:00:00', 15, 0, 'Standard morning shift 8AM-4PM'),
('EVENING', 'Evening Shift', '15:00:00', '23:00:00', 15, 0, 'Evening shift 3PM-11PM'),
('NIGHT', 'Night Shift', '23:00:00', '08:00:00', 15, 1, 'Night shift 11PM-8AM'),
('GENERAL', 'General Shift', '10:00:00', '18:00:00', 15, 0, 'General shift 10AM-6PM'),
('RAMADAN', 'Ramadan Shift', '09:00:00', '16:00:00', 15, 0, 'Ramadan special 9AM-4PM')
ON DUPLICATE KEY UPDATE shift_name=VALUES(shift_name);

-- ============================================
-- 2. Library Policies
-- ============================================
CREATE TABLE IF NOT EXISTS library_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_code VARCHAR(50) NOT NULL UNIQUE,
  policy_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policy_code (policy_code),
  INDEX idx_category (category),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO library_policies (policy_code, policy_name, description, category) VALUES
('OVERTIME', 'Overtime Policy', 'Overtime calculation and payment rules', 'Attendance'),
('HOLIDAY_INCT', 'Holiday Incentive', 'Holiday work incentive rules', 'Attendance'),
('DUTY_ROSTER', 'Duty Roster Policy', 'Duty schedule and roster rules', 'Attendance'),
('LEAVE', 'Leave Policy', 'Leave types and approval rules', 'Leave'),
('MATERNITY', 'Maternity Leave', 'Maternity leave benefits', 'Leave'),
('ATTENDANCE_BONUS', 'Attendance Bonus', 'Bonus for perfect attendance', 'Attendance'),
('ABSENT_DEDUCT', 'Absent Deduction', 'Salary deduction for absences', 'Salary'),
('LATE_DEDUCT', 'Late Deduction', 'Salary deduction for late arrivals', 'Salary'),
('BONUS', 'Bonus Policy', 'Performance and festival bonuses', 'Salary'),
('TAX', 'Tax Policy', 'Income tax calculation rules', 'Salary'),
('SHIFT', 'Shift Policy', 'Shift assignment and rotation', 'Attendance'),
('TIFFIN', 'Tiffin Bill Policy', 'Meal allowance rules', 'Allowance'),
('ALLOWANCE', 'Allowance Policy', 'General allowances configuration', 'Allowance'),
('EARLY_OUT', 'Early Out Deduction', 'Deduction for leaving early', 'Salary'),
('SERVICE_BENEFIT', 'Service Benefit', 'Long service benefits', 'Benefits'),
('HD_DEDUCT', 'Half Day Deduction', 'Half day absence rules', 'Salary')
ON DUPLICATE KEY UPDATE policy_name=VALUES(policy_name);

-- ============================================
-- 3. Library Policy Rules
-- ============================================
CREATE TABLE IF NOT EXISTS library_policy_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_id INT NOT NULL,
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  conditions JSON NULL,
  calculation_formula VARCHAR(500) NULL,
  is_active TINYINT(1) DEFAULT 1,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_policy_rule (policy_id, rule_code),
  INDEX idx_rule_code (rule_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Auth Users
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. CSV Employees - SOURCE OF TRUTH
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS csv_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `Emp No.` VARCHAR(50) DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) DEFAULT '',
    `Name` VARCHAR(200) DEFAULT '',
    Department VARCHAR(100),
    policy_tagging_id INT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_ac_no (`AC-No.`),
    INDEX idx_emp_no (`Emp No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`),
    INDEX idx_department (Department),
    INDEX idx_policy (policy_tagging_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Employees - Master Profiles
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
    emp_code VARCHAR(50),
    emp_id VARCHAR(50),
    punch_card VARCHAR(50),
    ac_no VARCHAR(50),
    full_name_bangla VARCHAR(200),
    full_name_english VARCHAR(200),
    fathers_name VARCHAR(200),
    fathers_name_bangla VARCHAR(200),
    mothers_name VARCHAR(200),
    mothers_name_bangla VARCHAR(200),
    spouse_name VARCHAR(200),
    spouse_name_bangla VARCHAR(200),
    blood_group VARCHAR(10),
    gender VARCHAR(20),
    birth_place VARCHAR(100),
    date_of_birth VARCHAR(20),
    age VARCHAR(10),
    religion VARCHAR(50),
    marital_status VARCHAR(20),
    nationality VARCHAR(50),
    national_id VARCHAR(50),
    mobile_no VARCHAR(20),
    birth_registration VARCHAR(50),
    category VARCHAR(50),
    company VARCHAR(100),
    location VARCHAR(100),
    division VARCHAR(100),
    department VARCHAR(100),
    section VARCHAR(100),
    subsection VARCHAR(100),
    designation_level VARCHAR(50),
    designation VARCHAR(100),
    functional_superior VARCHAR(100),
    leave_approving_authority VARCHAR(100),
    admin_superior VARCHAR(100),
    joining_date VARCHAR(20),
    provisional_tenor VARCHAR(50),
    target_confirm_date VARCHAR(20),
    actual_confirmation_date VARCHAR(20),
    skill_tagging VARCHAR(50),
    skill_rank VARCHAR(50),
    is_salary_restricted VARCHAR(10),
    is_attendance_restricted VARCHAR(10),
    reference VARCHAR(200),
    remark TEXT,
    leave_app_process_use VARCHAR(100),
    types_of_work VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active',
    employee_image VARCHAR(500),
    employee_signature VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ac_no (`AC-No.`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. Logs - Attendance Data
-- Single Identity: AC-No. (all 4 columns stored, AC-No. is the lookup key)
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- 4 Identity Columns from CSV (all stored for display, AC-No. is the lookup key)
    `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) NOT NULL DEFAULT '',
    `Name` VARCHAR(200) NOT NULL DEFAULT '',

    -- CSV Raw Data Columns (from CSV upload)
    `Auto-Assign` VARCHAR(50),
    `Date` VARCHAR(20),
    `Timetable` VARCHAR(50),
    `On duty` VARCHAR(10),
    `Off duty` VARCHAR(10),
    `Clock In` VARCHAR(10),
    `Clock Out` VARCHAR(10),
    `Normal` VARCHAR(10),
    `Real time` VARCHAR(10),
    `Late` VARCHAR(10),
    `Early` VARCHAR(10),
    `Absent` VARCHAR(10),
    `OT Time` VARCHAR(10),
    `Work Time` VARCHAR(10),
    `Exception` VARCHAR(100),
    `Must C/In` VARCHAR(10),
    `Must C/Out` VARCHAR(10),
    `Department` VARCHAR(100),
    `NDays` VARCHAR(10),
    `WeekEnd` VARCHAR(10),
    `Holiday` VARCHAR(10),
    `ATT_Time` VARCHAR(10),
    `NDays_OT` VARCHAR(10),
    `WeekEnd_OT` VARCHAR(10),
    `Holiday_OT` VARCHAR(10),
    `Status` VARCHAR(20),
    calculated_late VARCHAR(10) DEFAULT '',
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
    UNIQUE KEY unique_ac_date (`AC-No.`, `Date`),
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_emp_no (`Emp No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`),
    INDEX idx_emp_id (emp_id),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_day_month_year (day, month, year),
    INDEX idx_shift_code (shift_code),
    INDEX idx_actual_late (actual_late),
    INDEX idx_actual_absent (actual_absent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. Employee Policy Tagging
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_policy_tagging (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 Identity Columns (all stored for display, AC-No. is the lookup key)
  `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
  `AC-No.` VARCHAR(50) NOT NULL,
  `No.` VARCHAR(50) NOT NULL DEFAULT '',
  `Name` VARCHAR(200) NOT NULL DEFAULT '',
  category VARCHAR(100) NULL,
  company VARCHAR(100) NULL,
  location VARCHAR(100) NULL,
  division VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  section VARCHAR(100) NULL,
  subsection VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  overtime_policy_rule VARCHAR(50) NULL,
  overtime_policy_date DATE NULL,
  holiday_incentive_rule VARCHAR(50) NULL,
  holiday_incentive_date DATE NULL,
  duty_roster_policy_rule VARCHAR(50) NULL,
  duty_roster_policy_date DATE NULL,
  leave_policy_rule VARCHAR(50) NULL,
  leave_policy_date DATE NULL,
  maternity_leave_policy_rule VARCHAR(50) NULL,
  maternity_leave_policy_date DATE NULL,
  attendance_bonus_policy_rule VARCHAR(50) NULL,
  attendance_bonus_policy_date DATE NULL,
  absent_deduction_policy_rule VARCHAR(50) NULL,
  absent_deduction_policy_date DATE NULL,
  late_deduction_policy_rule VARCHAR(50) NULL,
  late_deduction_policy_date DATE NULL,
  bonus_policy_rule VARCHAR(50) NULL,
  bonus_policy_date DATE NULL,
  tax_policy_rule VARCHAR(50) NULL,
  tax_policy_date DATE NULL,
  shift_policy_rule VARCHAR(50) NULL,
  shift_policy_date DATE NULL,
  tiffin_bill_policy_rule VARCHAR(50) NULL,
  tiffin_bill_policy_date DATE NULL,
  allowance_policy_rule VARCHAR(50) NULL,
  allowance_policy_date DATE NULL,
  early_out_deduction_policy_rule VARCHAR(50) NULL,
  early_out_deduction_policy_date DATE NULL,
  service_benefit_policy_rule VARCHAR(50) NULL,
  service_benefit_policy_date DATE NULL,
  hd_deduct_rule_rule VARCHAR(50) NULL,
  hd_deduct_rule_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ac_no (`AC-No.`),
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_emp_no (`Emp No.`),
  INDEX idx_no (`No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. Employee Salary Information
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_salary_information (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `AC-No.` VARCHAR(50) NOT NULL,
  category VARCHAR(100) NULL,
  company VARCHAR(100) NULL,
  location VARCHAR(100) NULL,
  division VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  section VARCHAR(100) NULL,
  subsection VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  s_grade VARCHAR(50) NULL,
  st_salary VARCHAR(50) NULL,
  gross_salary VARCHAR(50) NULL,
  b_gross VARCHAR(50) NULL,
  cash_disbursement VARCHAR(10) DEFAULT 'No',
  policy VARCHAR(100) NULL,
  mode VARCHAR(50) DEFAULT 'Actual',
  total_additions VARCHAR(50) NULL DEFAULT '0.00',
  total_deductions VARCHAR(50) NULL DEFAULT '0.00',
  net_payable VARCHAR(50) NULL DEFAULT '0.00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ac_no (`AC-No.`),
  INDEX idx_ac_no (`AC-No.`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. Employee Salary Bank Info
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_salary_bank_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
    emp_code VARCHAR(50) NOT NULL,
    salary_bank VARCHAR(100),
    branch_name VARCHAR(100),
    account_no VARCHAR(50),
    salary_amount VARCHAR(50),
    salary_period VARCHAR(50),
    show_tax VARCHAR(10) DEFAULT 'Yes',
    sequence INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_ac_no (`AC-No.`),
    INDEX idx_emp_code (emp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. Employee Salary Breakdown
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_salary_breakdown (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
    emp_code VARCHAR(50) NOT NULL,
    payroll_head VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    percentage_formula VARCHAR(255) NULL,
    base_head VARCHAR(100) NULL,
    amount VARCHAR(50) NULL,
    sequence INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_emp_code (emp_code),
    UNIQUE KEY idx_unique_emp_payroll (emp_code, payroll_head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. Employee Addresses
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
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
    UNIQUE KEY unique_ac_no (`AC-No.`),
    INDEX idx_ac_no (`AC-No.`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. Employee Education
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS employee_education (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 Identity Columns (all stored for display, AC-No. is lookup key)
  `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
  `AC-No.` VARCHAR(50) NOT NULL,
  `No.` VARCHAR(50) NOT NULL DEFAULT '',
  `Name` VARCHAR(200) NOT NULL DEFAULT '',
  emp_code VARCHAR(50) NOT NULL,
  
  -- Additional info
  category VARCHAR(100) NULL,
  company VARCHAR(100) NULL,
  location VARCHAR(100) NULL,
  division VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  section VARCHAR(100) NULL,
  subsection VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  
  -- Education data
  course_name VARCHAR(100) NULL,
  board VARCHAR(100) NULL,
  institution VARCHAR(200) NULL,
  discipline VARCHAR(100) NULL,
  major_subject VARCHAR(100) NULL,
  year VARCHAR(10) NULL,
  result VARCHAR(50) NULL,
  education_nature VARCHAR(50) DEFAULT 'Academic',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE KEY unique_ac_no (`AC-No.`),
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_emp_no (`Emp No.`),
  INDEX idx_no (`No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 14. Attendance (Daily Sync)
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
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
    UNIQUE KEY unique_attendance (`AC-No.`, day, month, year),
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_emp_id (emp_id),
    INDEX idx_date (year, month, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 15. Real Time Logs (Optional)
-- Single Identity: AC-No.
-- ============================================
CREATE TABLE IF NOT EXISTS real_time_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `AC-No.` VARCHAR(50) NOT NULL,
    device_user_id VARCHAR(50),
    emp_code VARCHAR(50),
    employee_name VARCHAR(200),
    punch_time DATETIME,
    verify_type VARCHAR(50),
    status VARCHAR(50),
    device_ip VARCHAR(50),
    processed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_device_user_id (device_user_id),
    INDEX idx_punch_time (punch_time),
    INDEX idx_processed (processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
