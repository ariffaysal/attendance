-- employee-salary-breakdown.sql
-- Detailed salary component breakdown
-- 4 Identity Columns: Emp No., AC-No., No., Name

CREATE TABLE IF NOT EXISTS employee_salary_breakdown (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 Identity Columns (all stored for display, AC-No. is the lookup key)
    `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) NOT NULL DEFAULT '',
    `Name` VARCHAR(200) NOT NULL DEFAULT '',
    
    -- Link to salary information
    emp_code VARCHAR(50) NOT NULL,
    
    -- Component Details
    payroll_head VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    percentage_formula VARCHAR(255) NULL,
    base_head VARCHAR(100) NULL,
    amount VARCHAR(50) NULL,
    sequence INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_emp_code (emp_code),
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_emp_no (`Emp No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`),
    UNIQUE KEY idx_unique_emp_payroll (emp_code, payroll_head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration to add missing columns (run if table already exists)
ALTER TABLE employee_salary_breakdown 
ADD COLUMN IF NOT EXISTS `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `AC-No.` VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS `No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `Name` VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS emp_code VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS payroll_head VARCHAR(100) NOT NULL,
ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS percentage_formula VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS base_head VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS amount VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS sequence INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes if they don't exist
ALTER TABLE employee_salary_breakdown 
ADD INDEX IF NOT EXISTS idx_emp_code (emp_code),
ADD INDEX IF NOT EXISTS idx_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_emp_no (`Emp No.`),
ADD INDEX IF NOT EXISTS idx_no (`No.`),
ADD INDEX IF NOT EXISTS idx_name (`Name`),
ADD UNIQUE KEY IF NOT EXISTS idx_unique_emp_payroll (emp_code, payroll_head);
