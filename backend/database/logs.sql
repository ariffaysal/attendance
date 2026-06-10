-- logs.sql
-- Unified Attendance - RAW CSV data + Calculated fields
-- Primary identity: AC-No. (all 4 columns stored, AC-No. is the lookup key)

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

    -- Calculated Fields (populated during CSV import)
    calculated_late VARCHAR(10) DEFAULT '',
    emp_id VARCHAR(50),
    gross_salary DECIMAL(10,2) DEFAULT NULL,
    basic_salary DECIMAL(10,2) DEFAULT NULL,
    policy_type ENUM('gross', 'basic', 'not_applicable') DEFAULT 'not_applicable',

    -- Shift Information
    shift_code VARCHAR(50) DEFAULT NULL,
    shift_policy_rule VARCHAR(100) DEFAULT 'General shift (10 AM - 6 PM)',
    shift_start_time TIME DEFAULT NULL,
    shift_grace_minutes INT DEFAULT 15,

    -- Late Calculation Fields
    late_minutes INT DEFAULT 0,
    calculated_late_minutes INT DEFAULT 0,
    actual_late DECIMAL(5,2) DEFAULT 0.00,
    late_deduction_rule VARCHAR(50) DEFAULT '5_late_1_absent',
    total_late_count INT DEFAULT 0,
    total_absent_from_late INT DEFAULT 0,

    -- Absent Calculation Fields
    actual_absent DECIMAL(5,2) DEFAULT 0.00,
    absent_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
    absent_deduction_policy VARCHAR(50) DEFAULT NULL,

    -- Deduction Summary
    total_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
    late_count INT DEFAULT 0,
    late_deduction_days DECIMAL(5,2) DEFAULT 0.00,
    late_deduction_policy VARCHAR(50) DEFAULT NULL,

    -- Date Fields (calculated from CSV Date)
    day INT DEFAULT NULL,
    month INT DEFAULT NULL,
    year INT DEFAULT NULL,
    attendance_date DATE DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
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
