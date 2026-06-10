-- csv_employees.sql
-- SOURCE OF TRUTH - Employee master from CSV uploads
-- Primary identity: AC-No. (all 4 columns stored, but only 2 used for search: Name and AC-No.)

CREATE TABLE IF NOT EXISTS csv_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 Identity Columns from CSV (all stored for display, but only 2 used for search)
    `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) NOT NULL DEFAULT '',
    `Name` VARCHAR(200) NOT NULL DEFAULT '',
    
    -- Additional info from CSV
    Department VARCHAR(100),
    
    -- Policy assignment
    policy_tagging_id INT NULL,
    
    -- Status
    is_active TINYINT(1) DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE KEY unique_ac_no (`AC-No.`),      -- Primary lookup by AC-No.
    INDEX idx_emp_no (`Emp No.`),            -- Index for Emp No.
    INDEX idx_no (`No.`),                    -- Index for No.
    INDEX idx_name (`Name`),                 -- Search by Name
    INDEX idx_department (Department),
    INDEX idx_policy (policy_tagging_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration to add missing columns (run if table already exists)
ALTER TABLE csv_employees 
ADD COLUMN IF NOT EXISTS `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `AC-No.` VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS `No.` VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS `Name` VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS Department VARCHAR(100),
ADD COLUMN IF NOT EXISTS policy_tagging_id INT NULL,
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes if they don't exist
ALTER TABLE csv_employees 
ADD UNIQUE KEY IF NOT EXISTS unique_ac_no (`AC-No.`),
ADD INDEX IF NOT EXISTS idx_emp_no (`Emp No.`),
ADD INDEX IF NOT EXISTS idx_no (`No.`),
ADD INDEX IF NOT EXISTS idx_name (`Name`),
ADD INDEX IF NOT EXISTS idx_department (Department),
ADD INDEX IF NOT EXISTS idx_policy (policy_tagging_id);
