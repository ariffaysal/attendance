-- employees.sql
-- Master employee profiles with full details
-- Primary identity: AC-No. (all 4 columns stored, AC-No. is the lookup key)

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 Identity Columns (all stored for display, AC-No. is the lookup key)
    `Emp No.` VARCHAR(50) NOT NULL DEFAULT '',
    `AC-No.` VARCHAR(50) NOT NULL,
    `No.` VARCHAR(50) NOT NULL DEFAULT '',
    `Name` VARCHAR(200) NOT NULL DEFAULT '',
    
    -- Basic Info (sync-specific)
    emp_code VARCHAR(50),
    emp_id VARCHAR(50),
    punch_card VARCHAR(50),
    ac_no VARCHAR(50),
    
    -- Name Fields
    full_name_bangla VARCHAR(200),
    full_name_english VARCHAR(200),
    
    -- Family Fields
    fathers_name VARCHAR(200),
    fathers_name_bangla VARCHAR(200),
    mothers_name VARCHAR(200),
    mothers_name_bangla VARCHAR(200),
    spouse_name VARCHAR(200),
    spouse_name_bangla VARCHAR(200),
    
    -- Personal Fields
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
    
    -- Job Fields
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
    
    -- Media Fields
    employee_image VARCHAR(500),
    employee_signature VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_emp_no (`Emp No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
