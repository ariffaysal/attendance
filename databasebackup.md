# Database Backup - Table Structures

> **Purpose**: Complete SQL schema for recreating all tables after database wipe
> **Database**: `attendance_db`
> **Total Tables**: 15
> **Charset**: utf8mb4_unicode_ci

---

## 1. csv_employees (SOURCE OF TRUTH)
**Purpose**: Employee master from CSV uploads - PRIMARY identity for all modules

```sql
CREATE TABLE IF NOT EXISTS csv_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 IDENTITY COLUMNS (CSV standard - these are THE source of truth)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),            -- PRIMARY lookup key (UNIQUE)
    `No.` VARCHAR(50),               -- Employee code like E0453
    `Name` VARCHAR(200),             -- Employee name
    
    -- Additional info from CSV
    Department VARCHAR(100),
    
    -- Policy assignment
    policy_tagging_id INT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE KEY unique_ac_no (`AC-No.`),      -- Primary lookup by AC-No.
    UNIQUE KEY unique_emp_no (`Emp No.`),    -- Secondary by Emp No.
    INDEX idx_name (`Name`),                 -- Search by Name
    INDEX idx_department (Department),
    INDEX idx_policy (policy_tagging_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. employees (Master Profiles)
**Purpose**: Complete employee personal and job information

```sql
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 IDENTITY COLUMNS (CSV standard)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Basic Info (sync-specific)
    emp_code VARCHAR(50),
    emp_id VARCHAR(50),
    punch_card VARCHAR(50),
    ac_no VARCHAR(50),
    
    -- Name Fields (additional)
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 60 columns

---

## 3. logs (Unified Attendance - RAW + CALCULATED)
**Purpose**: SINGLE TABLE for all attendance data - both raw CSV and calculated fields

```sql
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- CSV Raw Data Columns (from CSV upload)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    `Auto-Assign` VARCHAR(50),
    `Date` VARCHAR(20),
    `Timetable` VARCHAR(50),
    `On duty` VARCHAR(10),
    `Off duty` VARCHAR(10),
    `Clock In` VARCHAR(10),
    `Clock Out` VARCHAR(10),
    `Normal` VARCHAR(10),
    `Real time` VARCHAR(10),
    `Late` VARCHAR(10),
    `Early` VARCHAR(10),
    `Absent` VARCHAR(10),
    `OT Time` VARCHAR(10),
    `Work Time` VARCHAR(10),
    `Exception` VARCHAR(100),
    `Must C/In` VARCHAR(10),
    `Must C/Out` VARCHAR(10),
    `Department` VARCHAR(100),
    `NDays` VARCHAR(10),
    `WeekEnd` VARCHAR(10),
    `Holiday` VARCHAR(10),
    `ATT_Time` VARCHAR(10),
    `NDays_OT` VARCHAR(10),
    `WeekEnd_OT` VARCHAR(10),
    `Holiday_OT` VARCHAR(10),
    `Status` VARCHAR(20),

    -- Calculated Fields (populated during CSV import)
    `calculated_late` VARCHAR(10) DEFAULT '',
    emp_id VARCHAR(50),
    gross_salary DECIMAL(10,2) DEFAULT NULL,
    basic_salary DECIMAL(10,2) DEFAULT NULL,
    policy_type ENUM('gross', 'basic', 'not_applicable') DEFAULT 'not_applicable',

    -- Shift Information
    shift_code VARCHAR(50) DEFAULT NULL,
    shift_policy_rule VARCHAR(100) DEFAULT 'General shift (10 AM - 6 PM)',
    shift_start_time TIME DEFAULT NULL,
    shift_grace_minutes INT DEFAULT 15,

    -- Late Calculation Fields
    late_minutes INT DEFAULT 0,
    calculated_late_minutes INT DEFAULT 0,
    actual_late DECIMAL(5,2) DEFAULT 0.00,
    late_deduction_rule VARCHAR(50) DEFAULT '5_late_1_absent',
    total_late_count INT DEFAULT 0,
    total_absent_from_late INT DEFAULT 0,

    -- Absent Calculation Fields
    actual_absent DECIMAL(5,2) DEFAULT 0.00,
    absent_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
    absent_deduction_policy VARCHAR(50) DEFAULT NULL,

    -- Deduction Summary
    total_deduction_amount DECIMAL(10,2) DEFAULT 0.00,
    late_count INT DEFAULT 0,
    late_deduction_days DECIMAL(5,2) DEFAULT 0.00,
    late_deduction_policy VARCHAR(50) DEFAULT NULL,

    -- Date Fields (calculated from CSV Date)
    day INT DEFAULT NULL,
    month INT DEFAULT NULL,
    year INT DEFAULT NULL,
    attendance_date DATE DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indexes
    UNIQUE KEY unique_emp_date (`Emp No.`, `Date`),
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`),
    INDEX idx_emp_id (emp_id),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_day_month_year (day, month, year),
    INDEX idx_shift_code (shift_code),
    INDEX idx_actual_late (actual_late),
    INDEX idx_actual_absent (actual_absent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 56 columns (38 raw CSV + 18 calculated)

---

## 4. employee_policy_tagging
**Purpose**: Maps employees to attendance/salary policies

```sql
CREATE TABLE IF NOT EXISTS employee_policy_tagging (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 IDENTITY COLUMNS (CSV data only)
  `Emp No.` VARCHAR(50),
  `AC-No.` VARCHAR(50),
  `No.` VARCHAR(50),
  `Name` VARCHAR(200),
  
  -- Additional employee info
  category VARCHAR(100) NULL,
  company VARCHAR(100) NULL,
  location VARCHAR(100) NULL,
  division VARCHAR(100) NULL,
  department VARCHAR(100) NULL,
  section VARCHAR(100) NULL,
  subsection VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  
  -- Policy Fields (16 policies)
  overtime_policy_rule VARCHAR(50) NULL,
  overtime_policy_date DATE NULL,
  holiday_incentive_rule VARCHAR(50) NULL,
  holiday_incentive_date DATE NULL,
  duty_roster_policy_rule VARCHAR(50) NULL,
  duty_roster_policy_date DATE NULL,
  leave_policy_rule VARCHAR(50) NULL,
  leave_policy_date DATE NULL,
  maternity_leave_policy_rule VARCHAR(50) NULL,
  maternity_leave_policy_date DATE NULL,
  attendance_bonus_policy_rule VARCHAR(50) NULL,
  attendance_bonus_policy_date DATE NULL,
  absent_deduction_policy_rule VARCHAR(50) NULL,
  absent_deduction_policy_date DATE NULL,
  late_deduction_policy_rule VARCHAR(50) NULL,
  late_deduction_policy_date DATE NULL,
  bonus_policy_rule VARCHAR(50) NULL,
  bonus_policy_date DATE NULL,
  tax_policy_rule VARCHAR(50) NULL,
  tax_policy_date DATE NULL,
  shift_policy_rule VARCHAR(50) NULL,
  shift_policy_date DATE NULL,
  tiffin_bill_policy_rule VARCHAR(50) NULL,
  tiffin_bill_policy_date DATE NULL,
  allowance_policy_rule VARCHAR(50) NULL,
  allowance_policy_date DATE NULL,
  early_out_deduction_policy_rule VARCHAR(50) NULL,
  early_out_deduction_policy_date DATE NULL,
  service_benefit_policy_rule VARCHAR(50) NULL,
  service_benefit_policy_date DATE NULL,
  hd_deduct_rule_rule VARCHAR(50) NULL,
  hd_deduct_rule_date DATE NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 43 columns (4 identity + 7 org + 32 policy fields)

---

## 5. employee_salary_information
**Purpose**: Employee salary header data

```sql
CREATE TABLE IF NOT EXISTS employee_salary_information (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 IDENTITY COLUMNS (CSV data only)
  `Emp No.` VARCHAR(50),
  `AC-No.` VARCHAR(50),
  `No.` VARCHAR(50),
  `Name` VARCHAR(200),
  
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
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 26 columns

---

## 6. employee_salary_bank_info
**Purpose**: Bank account information for salary disbursement

```sql
CREATE TABLE IF NOT EXISTS employee_salary_bank_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 IDENTITY COLUMNS (CSV data only)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Link to salary information
    emp_code VARCHAR(50) NOT NULL,
    
    -- Bank Information
    salary_bank VARCHAR(100),
    branch_name VARCHAR(100),
    account_no VARCHAR(50),
    salary_amount VARCHAR(50),
    salary_period VARCHAR(50),
    show_tax VARCHAR(10) DEFAULT 'Yes',
    sequence INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_emp_code (emp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 15 columns

---

## 7. employee_salary_breakdown
**Purpose**: Detailed salary component breakdown

```sql
CREATE TABLE IF NOT EXISTS employee_salary_breakdown (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 IDENTITY COLUMNS (CSV data only)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Link to salary information
    emp_code VARCHAR(50) NOT NULL,
    
    -- Component Details
    payroll_head VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    percentage_formula VARCHAR(255) NULL,
    base_head VARCHAR(100) NULL,
    amount VARCHAR(50) NULL,
    sequence INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_emp_code (emp_code),
    UNIQUE KEY idx_unique_emp_payroll (emp_code, payroll_head)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 14 columns

---

## 8. employee_addresses
**Purpose**: Employee present and permanent addresses

```sql
CREATE TABLE IF NOT EXISTS employee_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 4 IDENTITY COLUMNS (CSV data only)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Additional info
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
    
    -- Indexes
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 37 columns

---

## 9. employee_education
**Purpose**: Employee education history

```sql
CREATE TABLE IF NOT EXISTS employee_education (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- 4 IDENTITY COLUMNS (CSV data only)
  `Emp No.` VARCHAR(50),
  `AC-No.` VARCHAR(50),
  `No.` VARCHAR(50),
  `Name` VARCHAR(200),
  
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
  INDEX idx_ac_no (`AC-No.`),
  INDEX idx_name (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 23 columns

---

## 10. shifts
**Purpose**: Work shift definitions with grace periods

```sql
CREATE TABLE IF NOT EXISTS shifts (
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
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 14 columns

**Default Shifts**:
- Morning (8AM-4PM)
- Evening (3PM-11PM)
- Night (11PM-8AM)
- General (10AM-6PM)
- Ramadan (9AM-4PM)

---

## 11. library_policies
**Purpose**: Policy library for attendance and salary rules

```sql
CREATE TABLE IF NOT EXISTS library_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_code VARCHAR(50) NOT NULL UNIQUE,
  policy_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_policy_code (policy_code),
  INDEX idx_category (category),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 9 columns

**Default Policies** (16 total):
- OVERTIME, HOLIDAY_INCT, DUTY_ROSTER, LEAVE, MATERNITY
- ATTENDANCE_BONUS, ABSENT_DEDUCT, LATE_DEDUCT, BONUS, TAX
- SHIFT, TIFFIN, ALLOWANCE, EARLY_OUT, SERVICE_BENEFIT, HD_DEDUCT

---

## 12. library_policy_rules
**Purpose**: Individual rules within policies

```sql
CREATE TABLE IF NOT EXISTS library_policy_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_id INT NOT NULL,
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  conditions JSON NULL,
  calculation_formula VARCHAR(500) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (policy_id) REFERENCES library_policies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_policy_rule (policy_id, rule_code),
  INDEX idx_rule_code (rule_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 13 columns

---

## 13. auth_users
**Purpose**: User authentication for admin panel

```sql
CREATE TABLE IF NOT EXISTS auth_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    mobile_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
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
    INDEX idx_reset_code (reset_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 14 columns

---

## 14. real_time_logs (Optional)
**Purpose**: Real-time biometric/device punch data (if integrated)

```sql
CREATE TABLE IF NOT EXISTS real_time_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Identity columns
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    -- Device info
    device_user_id VARCHAR(50),
    emp_code VARCHAR(50),
    employee_name VARCHAR(200),
    punch_time DATETIME,
    verify_type VARCHAR(50),
    status VARCHAR(50),
    device_ip VARCHAR(50),
    processed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ac_no (`AC-No.`),
    INDEX idx_no (`No.`),
    INDEX idx_name (`Name`),
    INDEX idx_device_user_id (device_user_id),
    INDEX idx_punch_time (punch_time),
    INDEX idx_processed (processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column Count**: 15 columns
**Status**: Currently unused (optional feature)

---

## Summary Table

| # | Table Name | Columns | Purpose | Priority |
|---|------------|---------|---------|----------|
| 1 | csv_employees | 12 | **SOURCE OF TRUTH** - Employee identity | CRITICAL |
| 2 | employees | 60 | Full employee profiles | HIGH |
| 3 | logs | 56 | Attendance data (raw + calculated) | CRITICAL |
| 4 | employee_policy_tagging | 43 | Policy assignments | HIGH |
| 5 | employee_salary_information | 26 | Salary header data | HIGH |
| 6 | employee_salary_bank_info | 15 | Bank disbursement details | MEDIUM |
| 7 | employee_salary_breakdown | 14 | Salary component details | HIGH |
| 8 | employee_addresses | 37 | Present & permanent addresses | LOW |
| 9 | employee_education | 23 | Education history | LOW |
| 10 | shifts | 14 | Work shift definitions | HIGH |
| 11 | library_policies | 9 | Policy library | MEDIUM |
| 12 | library_policy_rules | 13 | Policy rules | MEDIUM |
| 13 | auth_users | 14 | User authentication | HIGH |
| 14 | real_time_logs | 15 | Real-time punch data (optional) | LOW |

**Total Columns Across All Tables**: ~347 columns

---

## Common 4 Identity Columns

These columns exist in ALL employee-related tables:

| CSV Column | Purpose | Example |
|------------|---------|---------|
| `Emp No.` | Employee Number | "EMP12345" |
| `AC-No.` | Access Card Number (PRIMARY KEY) | "E0453" |
| `No.` | Employee Code | "453" |
| `Name` | Employee Full Name | "John Doe" |

---

## Quick Create Order

Run SQL files in this order when rebuilding database:

1. `shifts.sql` - Shifts must exist first
2. `library.sql` - Policies must exist
3. `auth-users.sql` - Authentication
4. `csv-employees.sql` - **SOURCE OF TRUTH** (create this first among employee tables)
5. `employees.sql` - Master profiles
6. `logs.sql` - Attendance data
7. `employee-policy-tagging.sql` - Policy assignments
8. `employee-salary-information.sql` - Salary headers
9. `employee-salary-bank-info.sql` - Bank details
10. `employee-salary-breakdown.sql` - Salary components
11. `employee-addresses.sql` - Addresses
12. `employee-education.sql` - Education

---

*Generated for database rebuild - May 2026*
