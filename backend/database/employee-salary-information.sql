CREATE TABLE IF NOT EXISTS employee_salary_information (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_code VARCHAR(50) NOT NULL,
  emp_id VARCHAR(50) NULL,
  emp_name VARCHAR(100) NULL,
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
  INDEX idx_emp_code (emp_code),
  UNIQUE KEY unique_emp_code (emp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: Add summary columns to existing table (run this if table already exists)
-- ALTER TABLE employee_salary_information
--   ADD COLUMN IF NOT EXISTS total_additions VARCHAR(50) NULL DEFAULT '0.00' AFTER mode,
--   ADD COLUMN IF NOT EXISTS total_deductions VARCHAR(50) NULL DEFAULT '0.00' AFTER total_additions,
--   ADD COLUMN IF NOT EXISTS net_payable VARCHAR(50) NULL DEFAULT '0.00' AFTER total_deductions;

-- Migration: Add section and subsection columns if missing (run this if table already exists)
-- ALTER TABLE employee_salary_information
--   ADD COLUMN IF NOT EXISTS section VARCHAR(100) NULL AFTER department,
--   ADD COLUMN IF NOT EXISTS subsection VARCHAR(100) NULL AFTER section;

CREATE TABLE IF NOT EXISTS employee_salary_bank_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_code VARCHAR(50) NOT NULL,
  salary_bank VARCHAR(100) NULL,
  branch_name VARCHAR(100) NULL,
  account_no VARCHAR(50) NULL,
  salary_amount VARCHAR(50) NULL,
  salary_period VARCHAR(50) NULL,
  show_tax VARCHAR(10) DEFAULT 'Yes',
  sequence INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emp_code (emp_code),
  FOREIGN KEY (emp_code) REFERENCES employee_salary_information(emp_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_salary_breakdown (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  FOREIGN KEY (emp_code) REFERENCES employee_salary_information(emp_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
