-- employee-salary-information.sql
-- Employee salary header data
-- Primary identity: AC-No. (all 4 columns stored, AC-No. is the lookup key)

CREATE TABLE IF NOT EXISTS employee_salary_information (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 Identity Columns (all stored for display, AC-No. is the lookup key)
  `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
  `AC-No.` VARCHAR(50) NOT NULL,
  `No.` VARCHAR(50) NOT NULL DEFAULT '',
  `Name` VARCHAR(200) NOT NULL DEFAULT '',
  
  -- Additional info
  category VARCHAR(100) NULL,
  company VARCHAR(100) NULL,
  location VARCHAR(100) NULL,
  division VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  section VARCHAR(100) NULL,
  subsection VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  
  -- Salary Information Fields
  s_grade VARCHAR(50) NULL,
  st_salary VARCHAR(50) NULL,
  gross_salary VARCHAR(50) NULL,
  b_gross VARCHAR(50) NULL,
  cash_disbursement VARCHAR(10) DEFAULT 'No',
  policy VARCHAR(100) NULL,
  mode VARCHAR(50) DEFAULT 'Actual',
  
  -- Salary Summary Fields (for quick reference)
  total_additions VARCHAR(50) NULL DEFAULT '0.00',
  total_deductions VARCHAR(50) NULL DEFAULT '0.00',
  net_payable VARCHAR(50) NULL DEFAULT '0.00',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE KEY unique_ac_no (`AC-No.`),
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_emp_no (`Emp No.`),
  INDEX idx_no (`No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration to add missing columns (run if table already exists)
ALTER TABLE employee_salary_information 
ADD COLUMN IF NOT EXISTS category VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS company VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS location VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS division VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS section VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS subsection VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS s_grade VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS st_salary VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS gross_salary VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS b_gross VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS cash_disbursement VARCHAR(10) DEFAULT 'No',
ADD COLUMN IF NOT EXISTS policy VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'Actual',
ADD COLUMN IF NOT EXISTS total_additions VARCHAR(50) NULL DEFAULT '0.00',
ADD COLUMN IF NOT EXISTS total_deductions VARCHAR(50) NULL DEFAULT '0.00',
ADD COLUMN IF NOT EXISTS net_payable VARCHAR(50) NULL DEFAULT '0.00',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes if they don't exist
ALTER TABLE employee_salary_information 
ADD UNIQUE KEY IF NOT EXISTS unique_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_emp_no (`Emp No.`),
ADD INDEX IF NOT EXISTS idx_no (`No.`),
ADD INDEX IF NOT EXISTS idx_name (`Name`);
