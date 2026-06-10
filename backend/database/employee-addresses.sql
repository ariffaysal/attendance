-- Employee Addresses Table (Present & Permanent)
-- Run this in phpMyAdmin or MySQL CLI

CREATE TABLE IF NOT EXISTS employee_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Employee Identification
    emp_code VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    company VARCHAR(100),
    location VARCHAR(100),
    division_org VARCHAR(100),
    department VARCHAR(100),
    section VARCHAR(100),
    subsection VARCHAR(100),
    designation VARCHAR(100),
    
    -- Present Address
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
    
    -- Permanent Address
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
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_emp_code (emp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
