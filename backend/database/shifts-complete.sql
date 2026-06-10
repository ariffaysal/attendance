-- ========================================
-- SHIFTS SYSTEM - SINGLE COMPLETE FILE
-- ========================================
-- This is the ONLY shift-related SQL file needed for the entire system.
-- Contains everything for shift management:
-- 1. Shifts table structure
-- 2. All shift data connected to frontend/backend
-- 3. Shift policy rules for library system
-- 4. Verification and documentation
-- 
-- USAGE: Run this file once to setup complete shift system
-- ========================================

-- ========================================
-- 1. SHIFTS TABLE STRUCTURE
-- ========================================
-- Drop table if exists for clean recreation
DROP TABLE IF EXISTS shifts;

-- Create shifts table with all necessary fields
CREATE TABLE shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_code VARCHAR(50) NOT NULL UNIQUE,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT DEFAULT 0,
    is_night_shift TINYINT(1) DEFAULT 0,
    max_consecutive_days INT DEFAULT 5,
    rest_hours_required INT DEFAULT 8,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_shift_code (shift_code),
    INDEX idx_shift_name (shift_name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 2. INSERT SHIFT DATA
-- ========================================
-- Shift names are formatted to match policy dropdown exactly
-- This ensures shift_name in DB = shift_policy_rule in employee_policy_tagging

-- Basic Shifts (15 min grace period)
INSERT INTO shifts (shift_code, shift_name, start_time, end_time, grace_period_minutes, is_night_shift, description) VALUES
('MORNING', 'Morning Shift (8 AM - 4 PM)', '08:00:00', '16:00:00', 15, 0, 'Standard morning shift 8AM-4PM'),
('EVENING', 'Evening Shift (3 PM - 11 PM)', '15:00:00', '23:00:00', 15, 0, 'Evening shift 3PM-11PM'),
('NIGHT', 'Night Shift (11PM - 8 AM)', '23:00:00', '08:00:00', 15, 1, 'Night shift 11PM-8AM'),
('GENERAL', 'General Shift (10 AM - 6 PM)', '10:00:00', '18:00:00', 15, 0, 'General shift 10AM-6PM'),
('RAMADAN', 'Ramadan Shift (9 AM - 4 PM)', '09:00:00', '16:00:00', 15, 0, 'Ramadan special 9AM-4PM')
ON DUPLICATE KEY UPDATE 
  shift_name = VALUES(shift_name),
  start_time = VALUES(start_time),
  end_time = VALUES(end_time),
  grace_period_minutes = VALUES(grace_period_minutes),
  is_night_shift = VALUES(is_night_shift),
  description = VALUES(description);

-- Extended Shifts (45 min grace period)
INSERT INTO shifts (shift_code, shift_name, start_time, end_time, grace_period_minutes, is_night_shift, description) VALUES
('MORNING_8AM', 'Morning Shift (8 AM - 4 PM)', '08:00:00', '16:00:00', 45, 0, 'Morning shift with 45min grace'),
('EVENING_3PM', 'Evening Shift (3 PM - 11 PM)', '15:00:00', '23:00:00', 45, 0, 'Evening shift with 45min grace'),
('NIGHT_11PM', 'Night Shift (11PM - 8 AM)', '23:00:00', '08:00:00', 45, 1, 'Night shift with 45min grace'),
('GENERAL_10AM', 'General Shift (10 AM - 6 PM)', '10:00:00', '18:00:00', 45, 0, 'General shift with 45min grace'),
('RAMADAN_9AM', 'Ramadan Shift (9 AM - 4 PM)', '09:00:00', '16:00:00', 45, 0, 'Ramadan shift with 45min grace')
ON DUPLICATE KEY UPDATE 
  shift_name = VALUES(shift_name),
  start_time = VALUES(start_time),
  end_time = VALUES(end_time),
  grace_period_minutes = VALUES(grace_period_minutes),
  is_night_shift = VALUES(is_night_shift),
  description = VALUES(description);

-- ========================================
-- 3. SHIFT POLICY RULES IN LIBRARY
-- ========================================
-- Ensure library_policies table exists (from library.sql)
-- This section assumes library_policies already exists

-- Get the SHIFT policy ID
SET @shift_policy_id = (SELECT id FROM library_policies WHERE policy_code = 'SHIFT' LIMIT 1);

-- Create shift policy rules that match shifts table
-- These rules will appear in the Shift Policy dropdown
INSERT INTO library_policy_rules (policy_id, rule_code, rule_name, description, is_active) VALUES
(@shift_policy_id, 'MORNING_8AM', 'Morning Shift (8 AM - 4 PM)', 'Standard morning shift from 8:00 AM to 4:00 PM', 1),
(@shift_policy_id, 'EVENING_3PM', 'Evening Shift (3 PM - 11 PM)', 'Evening shift from 3:00 PM to 11:00 PM', 1),
(@shift_policy_id, 'NIGHT_11PM', 'Night Shift (11PM - 8 AM)', 'Night shift from 11:00 PM to 8:00 AM next day', 1),
(@shift_policy_id, 'GENERAL_10AM', 'General Shift (10 AM - 6 PM)', 'General shift from 10:00 AM to 6:00 PM', 1),
(@shift_policy_id, 'RAMADAN_9AM', 'Ramadan Shift (9 AM - 4 PM)', 'Ramadan special shift from 9:00 AM to 4:00 PM', 1)
ON DUPLICATE KEY UPDATE 
  rule_name = VALUES(rule_name),
  description = VALUES(description),
  is_active = VALUES(is_active);

-- ========================================
-- 4. VERIFICATION QUERIES
-- ========================================

-- Verify shifts data
SELECT '=== SHIFTS TABLE VERIFICATION ===' as info;
SELECT 
    id,
    shift_code,
    shift_name,
    start_time,
    end_time,
    grace_period_minutes,
    is_night_shift,
    description,
    is_active
FROM shifts 
WHERE is_active = 1 
ORDER BY start_time;

-- Verify shift policy rules in library
SELECT '=== SHIFT POLICY RULES VERIFICATION ===' as info;
SELECT 
    lp.policy_code,
    lp.policy_name,
    lpr.rule_code,
    lpr.rule_name,
    lpr.description,
    lpr.is_active
FROM library_policies lp
JOIN library_policy_rules lpr ON lp.id = lpr.policy_id
WHERE lp.policy_code = 'SHIFT'
ORDER BY lpr.rule_code;

-- Show how the system connects shift policy to shifts
SELECT '=== SHIFT POLICY TO SHIFTS MAPPING ===' as info;
SELECT 
    s.shift_code,
    s.shift_name as shift_table_name,
    s.start_time,
    s.end_time,
    s.grace_period_minutes,
    lpr.rule_name as policy_rule_name,
    CASE 
        WHEN s.shift_name = lpr.rule_name THEN '✓ MATCHES'
        ELSE '✗ MISMATCH'
    END as mapping_status
FROM shifts s
CROSS JOIN library_policy_rules lpr
JOIN library_policies lp ON lpr.policy_id = lp.id
WHERE lp.policy_code = 'SHIFT' AND s.is_active = 1 AND lpr.is_active = 1
ORDER BY s.shift_code, lpr.rule_code;

-- ========================================
-- 5. SYSTEM DOCUMENTATION
-- ========================================
SELECT '=== SHIFT SYSTEM DOCUMENTATION ===' as info;
SELECT '=== THIS IS THE ONLY SHIFT SQL FILE NEEDED ===' as file_note;
SELECT 'All other shift SQL files have been deleted' as cleanup_note;
SELECT '' as separator;
SELECT 'SYSTEM CONNECTIONS:' as connections_title;
SELECT '1. Frontend: /hrm/shifts/options endpoint provides shift dropdown options' as frontend;
SELECT '2. Backend: getShiftFromPolicyRule() matches policies to shift definitions' as backend;
SELECT '3. Database: employee_policy_tagging.shift_policy_rule stores shift selections' as database;
SELECT '4. Library: library_policy_rules provides shift policy rule options' as library;
SELECT '' as separator;
SELECT 'FILES CONNECTED TO THIS SYSTEM:' as files_title;
SELECT '- backend/src/modules/hrm/setup-data/shift.controller.ts' as controller;
SELECT '- backend/src/modules/hrm/setup-data/duty-roster.service.ts' as service;
SELECT '- frontend/src/services/shift.service.ts' as frontend_service;
SELECT '- frontend/src/app/employee-policy-tagging/new/page.tsx' as policy_form;
