-- auth-users.sql
-- User authentication for admin panel

CREATE TABLE IF NOT EXISTS auth_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    mobile_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'hr') DEFAULT 'staff',
    is_active TINYINT(1) DEFAULT 1,
    last_login TIMESTAMP NULL,
    -- Password reset fields
    reset_code VARCHAR(6) NULL,
    reset_code_expires TIMESTAMP NULL,
    is_reset_verified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_id (employee_id),
    INDEX idx_email (email),
    INDEX idx_reset_code (reset_code),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- For existing databases, uncomment and run:
-- ALTER TABLE auth_users ADD COLUMN role ENUM('admin', 'staff', 'hr') DEFAULT 'staff' AFTER password_hash;
-- ALTER TABLE auth_users ADD INDEX idx_role (role);
