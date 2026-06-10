-- employee-education.sql
-- Employee education history
-- Primary identity: AC-No. (all 4 columns stored, AC-No. is the lookup key)

CREATE TABLE IF NOT EXISTS employee_education (
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
