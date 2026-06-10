-- employee-salary-bank-info.sql
-- Bank account information for salary disbursement
-- 4 Identity Columns: Emp No., AC-No., No., Name

CREATE TABLE IF NOT EXISTS employee_salary_bank_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 Identity Columns (all stored for display, AC-No. is lookup key)
    `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) NOT NULL DEFAULT '',
    `Name` VARCHAR(200) NOT NULL DEFAULT '',
    
    -- Link to salary information
    emp_code VARCHAR(50) NOT NULL,
    
    -- Bank Information
    salary_bank VARCHAR(100),
    branch_name VARCHAR(100),
    account_no VARCHAR(50),
    salary_amount VARCHAR(50),
    salary_period VARCHAR(50),
    show_tax VARCHAR(10) DEFAULT 'Yes',
    sequence INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE KEY unique_ac_no (`AC-No.`),
    INDEX idx_emp_code (emp_code),
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_emp_no (`Emp No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration to add missing columns (run if table already exists)
ALTER TABLE employee_salary_bank_info 
ADD COLUMN IF NOT EXISTS `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `AC-No.` VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS `No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `Name` VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS emp_code VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS salary_bank VARCHAR(100),
ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS salary_amount VARCHAR(50),
ADD COLUMN IF NOT EXISTS salary_period VARCHAR(50),
ADD COLUMN IF NOT EXISTS show_tax VARCHAR(10) DEFAULT 'Yes',
ADD COLUMN IF NOT EXISTS sequence INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes if they don't exist
ALTER TABLE employee_salary_bank_info 
ADD UNIQUE KEY IF NOT EXISTS unique_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_emp_code (emp_code),
ADD INDEX IF NOT EXISTS idx_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_emp_no (`Emp No.`),
ADD INDEX IF NOT EXISTS idx_no (`No.`),
ADD INDEX IF NOT EXISTS idx_name (`Name`);
