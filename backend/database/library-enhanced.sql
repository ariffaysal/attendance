-- ============================================================
-- Enhanced Library Schema - Dynamic Policy Assignment System
-- ============================================================

-- 1. Enhanced Library Policies Table (add version support)
ALTER TABLE library_policies 
ADD COLUMN version INT DEFAULT 1 AFTER is_active,
ADD COLUMN created_by VARCHAR(50) NULL AFTER version,
ADD COLUMN is_template BOOLEAN DEFAULT FALSE AFTER created_by;

-- 2. Enhanced Policy Rules Table (add more metadata)
ALTER TABLE library_policy_rules
ADD COLUMN priority INT DEFAULT 100 AFTER calculation_formula,
ADD COLUMN rule_type ENUM('standard', 'exception', 'override') DEFAULT 'standard' AFTER priority,
ADD COLUMN condition_logic VARCHAR(10) DEFAULT 'AND' COMMENT 'AND or OR for multiple conditions' AFTER rule_type;

-- 3. NEW: Employee Policy Assignments (Dynamic Junction Table)
-- Replaces the hardcoded columns in employee_policy_tagging
CREATE TABLE IF NOT EXISTS employee_policy_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_code VARCHAR(50) NOT NULL,
  policy_id INT NOT NULL,
  rule_id INT NOT NULL,
  
  -- Assignment metadata
  assigned_date DATE NOT NULL,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  assigned_by VARCHAR(50) NULL,
  
  -- Status and notes
  is_active BOOLEAN DEFAULT TRUE,
  is_override BOOLEAN DEFAULT FALSE COMMENT 'Special override from standard rules',
  notes TEXT NULL,
  
  -- Audit timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Constraints
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES library_policy_rules(id) ON DELETE CASCADE,
  
  -- Ensure one active assignment per employee per policy
  UNIQUE KEY unique_emp_policy_active (emp_code, policy_id, is_active),
  
  -- Indexes for performance
  INDEX idx_emp_code (emp_code),
  INDEX idx_policy_id (policy_id),
  INDEX idx_rule_id (rule_id),
  INDEX idx_effective_date (effective_date),
  INDEX idx_expiry_date (expiry_date),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. NEW: Policy Version History
CREATE TABLE IF NOT EXISTS library_policy_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_id INT NOT NULL,
  version_number INT NOT NULL,
  policy_code VARCHAR(50) NOT NULL,
  policy_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  policy_data JSON NOT NULL COMMENT 'Snapshot of policy + all rules',
  created_by VARCHAR(50) NULL,
  change_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_policy_version (policy_id, version_number),
  INDEX idx_version_number (version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. NEW: Bulk Assignment Jobs (for tracking bulk operations)
CREATE TABLE IF NOT EXISTS library_bulk_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_name VARCHAR(200) NOT NULL,
  policy_id INT NOT NULL,
  rule_id INT NOT NULL,
  filter_criteria JSON NOT NULL COMMENT 'Filters used for selection',
  total_affected INT DEFAULT 0,
  successful_assignments INT DEFAULT 0,
  failed_assignments INT DEFAULT 0,
  error_details JSON NULL,
  executed_by VARCHAR(50) NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES library_policy_rules(id) ON DELETE CASCADE,
  INDEX idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. NEW: Policy Rule Test Cases (for testing rule conditions)
CREATE TABLE IF NOT EXISTS library_rule_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_id INT NOT NULL,
  test_name VARCHAR(200) NOT NULL,
  test_data JSON NOT NULL COMMENT 'Sample employee data for testing',
  expected_result BOOLEAN NOT NULL,
  actual_result BOOLEAN NULL,
  test_passed BOOLEAN NULL,
  test_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (rule_id) REFERENCES library_policy_rules(id) ON DELETE CASCADE,
  INDEX idx_rule_id (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Migration: Convert existing hardcoded policy data to new junction table
-- This is a one-time migration script
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS MigratePolicyTaggingToDynamic()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_emp_code VARCHAR(50);
  DECLARE v_policy_code VARCHAR(50);
  DECLARE v_rule_value VARCHAR(50);
  DECLARE v_policy_date DATE;
  
  -- Cursor for employee policy tagging records
  DECLARE cur CURSOR FOR 
    SELECT emp_code, 'OVERTIME' as policy, overtime_policy_rule, overtime_policy_date 
    FROM employee_policy_tagging 
    WHERE overtime_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'HOLIDAY_INCT', holiday_incentive_rule, holiday_incentive_date
    FROM employee_policy_tagging WHERE holiday_incentive_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'DUTY_ROSTER', duty_roster_policy_rule, duty_roster_policy_date
    FROM employee_policy_tagging WHERE duty_roster_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'LEAVE', leave_policy_rule, leave_policy_date
    FROM employee_policy_tagging WHERE leave_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'MATERNITY', maternity_leave_policy_rule, maternity_leave_policy_date
    FROM employee_policy_tagging WHERE maternity_leave_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'ATTENDANCE_BONUS', attendance_bonus_policy_rule, attendance_bonus_policy_date
    FROM employee_policy_tagging WHERE attendance_bonus_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'ABSENT_DEDUCT', absent_deduction_policy_rule, absent_deduction_policy_date
    FROM employee_policy_tagging WHERE absent_deduction_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'LATE_DEDUCT', late_deduction_policy_rule, late_deduction_policy_date
    FROM employee_policy_tagging WHERE late_deduction_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'BONUS', bonus_policy_rule, bonus_policy_date
    FROM employee_policy_tagging WHERE bonus_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'TAX', tax_policy_rule, tax_policy_date
    FROM employee_policy_tagging WHERE tax_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'SHIFT', shift_policy_rule, shift_policy_date
    FROM employee_policy_tagging WHERE shift_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'TIFFIN', tiffin_bill_policy_rule, tiffin_bill_policy_date
    FROM employee_policy_tagging WHERE tiffin_bill_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'ALLOWANCE', allowance_policy_rule, allowance_policy_date
    FROM employee_policy_tagging WHERE allowance_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'EARLY_OUT', early_out_deduction_policy_rule, early_out_deduction_policy_date
    FROM employee_policy_tagging WHERE early_out_deduction_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'SERVICE_BENEFIT', service_benefit_policy_rule, service_benefit_policy_date
    FROM employee_policy_tagging WHERE service_benefit_policy_rule IS NOT NULL
    UNION ALL
    SELECT emp_code, 'HD_DEDUCT', hd_deduct_rule_rule, hd_deduct_rule_date
    FROM employee_policy_tagging WHERE hd_deduct_rule_rule IS NOT NULL;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN cur;
  
  read_loop: LOOP
    FETCH cur INTO v_emp_code, v_policy_code, v_rule_value, v_policy_date;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Insert into new junction table
    INSERT INTO employee_policy_assignments 
      (emp_code, policy_id, rule_id, assigned_date, effective_date, assigned_by, notes)
    SELECT 
      v_emp_code,
      p.id,
      r.id,
      COALESCE(v_policy_date, CURDATE()),
      v_policy_date,
      'migration',
      CONCAT('Migrated from legacy policy tagging - Rule: ', v_rule_value)
    FROM library_policies p
    JOIN library_policy_rules r ON r.policy_id = p.id
    WHERE p.policy_code = v_policy_code 
      AND r.rule_code = v_rule_value
    ON DUPLICATE KEY UPDATE
      rule_id = VALUES(rule_id),
      updated_at = CURRENT_TIMESTAMP;
      
  END LOOP;
  
  CLOSE cur;
END //

DELIMITER ;

-- ============================================================
-- Views for backward compatibility
-- ============================================================

-- View to emulate old employee_policy_tagging structure
CREATE OR REPLACE VIEW v_employee_policy_tagging AS
SELECT 
  e.emp_code,
  MAX(CASE WHEN p.policy_code = 'OVERTIME' THEN r.rule_code END) as overtime_policy_rule,
  MAX(CASE WHEN p.policy_code = 'OVERTIME' THEN a.effective_date END) as overtime_policy_date,
  MAX(CASE WHEN p.policy_code = 'HOLIDAY_INCT' THEN r.rule_code END) as holiday_incentive_rule,
  MAX(CASE WHEN p.policy_code = 'HOLIDAY_INCT' THEN a.effective_date END) as holiday_incentive_date,
  MAX(CASE WHEN p.policy_code = 'DUTY_ROSTER' THEN r.rule_code END) as duty_roster_policy_rule,
  MAX(CASE WHEN p.policy_code = 'DUTY_ROSTER' THEN a.effective_date END) as duty_roster_policy_date,
  MAX(CASE WHEN p.policy_code = 'LEAVE' THEN r.rule_code END) as leave_policy_rule,
  MAX(CASE WHEN p.policy_code = 'LEAVE' THEN a.effective_date END) as leave_policy_date,
  MAX(CASE WHEN p.policy_code = 'MATERNITY' THEN r.rule_code END) as maternity_leave_policy_rule,
  MAX(CASE WHEN p.policy_code = 'MATERNITY' THEN a.effective_date END) as maternity_leave_policy_date,
  MAX(CASE WHEN p.policy_code = 'ATTENDANCE_BONUS' THEN r.rule_code END) as attendance_bonus_policy_rule,
  MAX(CASE WHEN p.policy_code = 'ATTENDANCE_BONUS' THEN a.effective_date END) as attendance_bonus_policy_date,
  MAX(CASE WHEN p.policy_code = 'ABSENT_DEDUCT' THEN r.rule_code END) as absent_deduction_policy_rule,
  MAX(CASE WHEN p.policy_code = 'ABSENT_DEDUCT' THEN a.effective_date END) as absent_deduction_policy_date,
  MAX(CASE WHEN p.policy_code = 'LATE_DEDUCT' THEN r.rule_code END) as late_deduction_policy_rule,
  MAX(CASE WHEN p.policy_code = 'LATE_DEDUCT' THEN a.effective_date END) as late_deduction_policy_date,
  MAX(CASE WHEN p.policy_code = 'BONUS' THEN r.rule_code END) as bonus_policy_rule,
  MAX(CASE WHEN p.policy_code = 'BONUS' THEN a.effective_date END) as bonus_policy_date,
  MAX(CASE WHEN p.policy_code = 'TAX' THEN r.rule_code END) as tax_policy_rule,
  MAX(CASE WHEN p.policy_code = 'TAX' THEN a.effective_date END) as tax_policy_date,
  MAX(CASE WHEN p.policy_code = 'SHIFT' THEN r.rule_code END) as shift_policy_rule,
  MAX(CASE WHEN p.policy_code = 'SHIFT' THEN a.effective_date END) as shift_policy_date,
  MAX(CASE WHEN p.policy_code = 'TIFFIN' THEN r.rule_code END) as tiffin_bill_policy_rule,
  MAX(CASE WHEN p.policy_code = 'TIFFIN' THEN a.effective_date END) as tiffin_bill_policy_date,
  MAX(CASE WHEN p.policy_code = 'ALLOWANCE' THEN r.rule_code END) as allowance_policy_rule,
  MAX(CASE WHEN p.policy_code = 'ALLOWANCE' THEN a.effective_date END) as allowance_policy_date,
  MAX(CASE WHEN p.policy_code = 'EARLY_OUT' THEN r.rule_code END) as early_out_deduction_policy_rule,
  MAX(CASE WHEN p.policy_code = 'EARLY_OUT' THEN a.effective_date END) as early_out_deduction_policy_date,
  MAX(CASE WHEN p.policy_code = 'SERVICE_BENEFIT' THEN r.rule_code END) as service_benefit_policy_rule,
  MAX(CASE WHEN p.policy_code = 'SERVICE_BENEFIT' THEN a.effective_date END) as service_benefit_policy_date,
  MAX(CASE WHEN p.policy_code = 'HD_DEDUCT' THEN r.rule_code END) as hd_deduct_rule_rule,
  MAX(CASE WHEN p.policy_code = 'HD_DEDUCT' THEN a.effective_date END) as hd_deduct_rule_date
FROM employees e
LEFT JOIN employee_policy_assignments a ON e.emp_code = a.emp_code AND a.is_active = TRUE
LEFT JOIN library_policies p ON a.policy_id = p.id
LEFT JOIN library_policy_rules r ON a.rule_id = r.id
GROUP BY e.emp_code;

-- View for active policy assignments with employee details
CREATE OR REPLACE VIEW v_employee_policies_active AS
SELECT 
  a.id as assignment_id,
  a.emp_code,
  e.full_name_english as emp_name,
  e.department,
  e.designation,
  p.id as policy_id,
  p.policy_code,
  p.policy_name,
  p.category as policy_category,
  r.id as rule_id,
  r.rule_code,
  r.rule_name,
  a.assigned_date,
  a.effective_date,
  a.expiry_date,
  a.is_override,
  a.notes,
  CASE 
    WHEN a.effective_date IS NULL OR a.effective_date <= CURDATE() THEN 'Active'
    WHEN a.effective_date > CURDATE() THEN 'Pending'
    WHEN a.expiry_date IS NOT NULL AND a.expiry_date < CURDATE() THEN 'Expired'
    ELSE 'Active'
  END as status
FROM employee_policy_assignments a
JOIN employees e ON a.emp_code = e.emp_code
JOIN library_policies p ON a.policy_id = p.id
JOIN library_policy_rules r ON a.rule_id = r.id
WHERE a.is_active = TRUE;
