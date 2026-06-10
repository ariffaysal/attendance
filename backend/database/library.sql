-- library.sql
-- Policy library for attendance and salary rules
-- Includes: library_policies + library_policy_rules

-- ============================================
-- 1. library_policies - Policy header table
-- ============================================
CREATE TABLE IF NOT EXISTS library_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_code VARCHAR(50) NOT NULL UNIQUE,
  policy_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_policy_code (policy_code),
  INDEX idx_category (category),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Policies (16 total)
INSERT INTO library_policies (policy_code, policy_name, description, category) VALUES
('OVERTIME', 'Overtime Policy', 'Overtime calculation and payment rules', 'Attendance'),
('HOLIDAY_INCT', 'Holiday Incentive', 'Holiday work incentive rules', 'Attendance'),
('DUTY_ROSTER', 'Duty Roster Policy', 'Duty schedule and roster rules', 'Attendance'),
('LEAVE', 'Leave Policy', 'Leave types and approval rules', 'Leave'),
('MATERNITY', 'Maternity Leave', 'Maternity leave benefits', 'Leave'),
('ATTENDANCE_BONUS', 'Attendance Bonus', 'Bonus for perfect attendance', 'Attendance'),
('ABSENT_DEDUCT', 'Absent Deduction', 'Salary deduction for absences', 'Salary'),
('LATE_DEDUCT', 'Late Deduction', 'Salary deduction for late arrivals', 'Salary'),
('BONUS', 'Bonus Policy', 'Performance and festival bonuses', 'Salary'),
('TAX', 'Tax Policy', 'Income tax calculation rules', 'Salary'),
('SHIFT', 'Shift Policy', 'Shift assignment and rotation', 'Attendance'),
('TIFFIN', 'Tiffin Bill Policy', 'Meal allowance rules', 'Allowance'),
('ALLOWANCE', 'Allowance Policy', 'General allowances configuration', 'Allowance'),
('EARLY_OUT', 'Early Out Deduction', 'Deduction for leaving early', 'Salary'),
('SERVICE_BENEFIT', 'Service Benefit', 'Long service benefits', 'Benefits'),
('HD_DEDUCT', 'Half Day Deduction', 'Half day absence rules', 'Salary')
ON DUPLICATE KEY UPDATE policy_name=VALUES(policy_name);

-- ============================================
-- 2. library_policy_rules - Individual rules
-- ============================================
CREATE TABLE IF NOT EXISTS library_policy_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_id INT NOT NULL,
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  conditions JSON NULL,
  calculation_formula VARCHAR(500) NULL,
  is_active TINYINT(1) DEFAULT 1,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_policy_rule (policy_id, rule_code),
  INDEX idx_rule_code (rule_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
