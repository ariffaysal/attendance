# Attendance System - Complete Architecture Review

## Executive Summary

This is an **Attendance Management System** built with:
- **Frontend**: Next.js + TypeScript + Bootstrap
- **Backend**: NestJS + TypeScript + MySQL
- **Database**: MySQL with 12+ related tables
- **Purpose**: Process attendance CSV files, calculate late/absent deductions, generate Job Cards and Salary Sheets

---

## 1. System Architecture Overview

### 1.1 Core Tables (Database Structure)

| Table | Purpose | Data Source |
|-------|---------|-------------|
| **logs** | Stores ALL attendance data (raw CSV + calculated fields) | CSV Upload |
| **csv_employees** | UNIQUE employee list from CSV | CSV Upload |
| **employees** | Master employee profiles | Manual Entry (synced from csv_employees) |
| **employee_policy_tagging** | Policy assignments per employee | Manual Entry |
| **employee_salary_information** | Salary data (gross, basic) | Manual Entry |
| **shifts** | Shift definitions (start time, grace period) | Pre-defined |
| **employee_shift_assignments** | Per-date shift assignments | Manual Entry (optional) |
| **auth_users** | Login credentials | Manual Entry |

### 1.2 Key Principle
> **csv_employees is the SOURCE OF TRUTH** - All employee lookups start from this table using `AC-No.` or `No.` columns

---

## 2. Data Flow - Complete Process

### 2.1 CSV Upload Flow (The Entry Point)

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: User uploads CSV via /csv-upload page                      │
│  Frontend: POST /attendance/upload-csv                              │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Backend processes each CSV row                             │
│  File: attendance.service.ts → importCsvRecords()                   │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐ ┌─────────────┐ ┌─────────────┐
│ Extract│ │  Calculate  │ │   Insert    │
│  Data  │ │    Late     │ │   to DB     │
└────┬───┘ └──────┬──────┘ └──────┬──────┘
     │            │               │
     │            ▼               │
     │    ┌──────────────┐        │
     │    │ Get shift    │        │
     │    │ from policy  │        │
     │    │ tagging      │        │
     │    └──────────────┘        │
     │                            │
     └──────────────┬─────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: Data saved to logs table                                   │
│  - Raw CSV data (Emp No., Clock In, Clock Out, etc.)                │
│  - Calculated fields (late_minutes, actual_late, shift_code, etc.)  │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Employee list updated in csv_employees                   │
│  - UNIQUE employees only (updates existing, adds new)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. How Late is Calculated

### 3.1 Late Calculation Process

```
┌─────────────────────────────────────────────────────────────────────┐
│  INPUT: Employee clocks in at 09:15 AM                              │
│  STEP 1: Get employee's shift information                         │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Lookup shift_policy_rule from employee_policy_tagging      │
│  Example: "Morning Shift (8 A - 4 PM)"                             │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: Query shifts table by shift_name                           │
│  Get: start_time = "08:00:00", grace_period_minutes = 45           │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Calculate threshold time                                   │
│  shift_start (08:00) + grace (45 min) = 08:45 AM                    │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: Compare clock-in vs threshold                              │
│  Clock In: 09:15 AM                                                 │
│  Threshold: 08:45 AM                                                │
│  Late: 09:15 - 08:45 = 30 minutes                                   │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OUTPUT: Store in logs table                                        │
│  - late_minutes: 30                                                 │
│  - actual_late: 0.5 (hours)                                         │
│  - calculated_late: "00:30"                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Late Calculation Code Flow

```typescript
// 1. CSV Import calls calculateLateForCsvImport()
const calculatedLate = await this.calculateLateForCsvImport(empCode, date, clockIn, name);

// 2. Get shift start time with grace period
const shiftStartWithGrace = await this.getEmployeeShiftStartTime(empCode, date, name);
// Returns: "08:45" (shift start 08:00 + 45 min grace)

// 3. Calculate late minutes
const lateMinutes = Math.max(0, clockMinutes - shiftMinutes);
// Example: 09:15 (555 min) - 08:45 (525 min) = 30 minutes late

// 4. Store in logs table
late_minutes = 30
calculated_late_minutes = 30
actual_late = 0.5 (30/60 hours)
```

### 3.3 Shift Lookup Hierarchy

```
Priority 1: employee_shift_assignments (specific date assignment)
    ↓ Not found or table doesn't exist
Priority 2: employee_policy_tagging.shift_policy_rule (default shift)
    ↓ Parse shift name from text
Priority 3: shifts table lookup by shift_name
    ↓ Match found
Priority 4: Return start_time + grace_period_minutes
    ↓ No match
Fallback: Default shift "General shift (10 AM - 6 PM)" with 45 min grace
```

### 3.4 Automatic Late Recalculation (Dynamic Policy Updates)

When you change an employee's shift policy in `employee_policy_tagging`, the system automatically recalculates all their `calculated_late` values in the `logs` table.

**How It Works:**

```
User changes policy in employee_policy_tagging
    ↓
Trigger: trg_recalculate_late_on_policy_update (AFTER UPDATE)
    ↓
For each matching log record:
    1. Get new shift start time from policy (Morning=08:00, Evening=15:00, etc.)
    2. Add grace period (45 minutes)
    3. Calculate threshold: shift_start + grace
    4. Compare clock_in vs threshold
    5. Update calculated_late in logs table
    ↓
Job Card now shows updated late values
```

**Example:**

| Action | Employee | Clock In | Old Policy | Old Late | New Policy | New Late |
|--------|----------|----------|------------|----------|------------|----------|
| Policy Change | E001 | 09:45 | Morning (8-4) | 01:00 | Ramadan (9-5) | 00:00 |

**Database Trigger:**
```sql
-- Located in: backend/database/auto-recalculate-late-trigger-fixed.sql
CREATE TRIGGER trg_recalculate_late_on_policy_update
AFTER UPDATE ON employee_policy_tagging
FOR EACH ROW
BEGIN
    IF OLD.shift_policy_rule != NEW.shift_policy_rule THEN
        UPDATE logs l
        -- Recalculate late based on new policy
        SET calculated_late = ...
        WHERE employee matches;
    END IF;
END;
```

**Manual Recalculation API:**
If needed, you can also manually trigger recalculation:
```bash
POST /attendance/recalculate-late
Body: { "empCode": "E001" }
```

---

## 4. Database Storage - Where Data is Saved

### 4.1 During CSV Upload

| Data | Destination Table | Fields |
|------|-------------------|--------|
| Raw CSV rows | **logs** | All CSV columns (Emp No., Clock In, Clock Out, Date, etc.) |
| Calculated late | **logs** | late_minutes, actual_late, calculated_late |
| Shift info | **logs** | shift_code, shift_start_time, shift_grace_minutes |
| Salary info | **logs** | gross_salary, basic_salary, policy_type |
| Deductions | **logs** | late_deduction_policy, absent_deduction_policy |
| Date parsed | **logs** | day, month, year, attendance_date |
| Unique employees | **csv_employees** | Emp No., AC-No., No., Name |

### 4.2 Manual Entry Pages

| Page | Table | Purpose |
|------|-------|---------|
| /employee-policy-tagging | employee_policy_tagging | Assign policies (late, absent, shift) |
| /employee-salary-information | employee_salary_information | Enter gross/basic salary |
| /employee-address | employee_addresses | Employee contact info |
| /employee-education | employee_education | Employee qualifications |
| /duty-roster | employee_shift_assignments | Per-date shift assignments |

---

## 5. How Reports Are Generated

### 5.1 Job Cards (/job-cards)

```
User selects date range → getJobCards()
                        → Query logs table
                        → Filter by date range (attendance_date BETWEEN)
                        → Group by employee (AC-No.)
                        → Return aggregated data
                        → Display daily attendance per employee
```

**Data Source**: `logs` table (raw + calculated fields)

### 5.2 Salary Sheet (/salary-sheet)

```
User selects date range → getSalaryAttendance()
                        → Query logs table
                        → Aggregate by employee
                        → Calculate deductions:
                           - 5 late = 1 absent (late_deduction_policy)
                           - Absent deduction (ON_BASIC or ON_GROSS)
                        → Return salary data with deductions
                        → Display salary table
```

**Data Source**: `logs` table (calculated fields)

---

## 6. Complete Data Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           CSV UPLOAD                                       │
│                      (/csv-upload page)                                    │
└─────────────────────────┬──────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      Backend Processing                                    │
│              (attendance.service.ts: importCsvRecords)                   │
└─────────────────────────┬──────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Extract    │  │  Calculate   │  │    Save      │
│  CSV Data    │  │    Late      │  │   to logs    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 ▼                 │
       │         ┌──────────────┐         │
       │         │ Get shift    │         │
       │         │ from policy  │         │
       │         │ tagging      │         │
       │         └──────┬───────┘         │
       │                │                 │
       │                ▼                 │
       │         ┌──────────────┐         │
       │         │ shifts table │         │
       │         │ (lookup by   │         │
       │         │ shift_name)  │         │
       │         └──────┬───────┘         │
       │                │                 │
       └────────────────┴─────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          logs TABLE                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Raw CSV Data      │  │  Calculated Fields  │  │   Date Fields       │  │
│  │   ─────────────     │  │   ───────────────   │  │   ───────────       │  │
│  │   Emp No.           │  │   late_minutes      │  │   day               │  │
│  │   AC-No.            │  │   actual_late       │  │   month             │  │
│  │   Clock In          │  │   shift_code        │  │   year              │  │
│  │   Clock Out         │  │   gross_salary      │  │   attendance_date   │  │
│  │   Date              │  │   basic_salary      │  │                     │  │
│  │   Status            │  │   policy_type       │  │                     │  │
│  └─────────────────────┘  │   late_deduction_   │  │                     │  │
│                           │     policy          │  │                     │  │
│                           └─────────────────────┘  └─────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│    Job Cards Page    │      │   Salary Sheet Page  │
│    (/job-cards)      │      │   (/salary-sheet)    │
│                      │      │                      │
│  - Daily attendance  │      │  - Monthly salary    │
│  - Late times        │      │  - Late deductions   │
│  - Clock in/out      │      │  - Absent deductions │
└──────────────────────┘      └──────────────────────┘
```

---

## 7. Key Configuration Tables

### 7.1 shifts Table
Stores shift definitions used for late calculation:
```sql
shift_code: "MORNING_8AM"
shift_name: "Morning Shift (8 A - 4 PM)"
start_time: "08:00:00"
grace_period_minutes: 45
```

### 7.2 employee_policy_tagging Table
Stores policy assignments per employee:
```sql
AC-No.: "12345"
No.: "E001"
shift_policy_rule: "Morning Shift (8 A - 4 PM)"
late_deduction_policy_rule: "APPLICABLE"
absent_deduction_policy_rule: "ON_BASIC"
```

### 7.3 employee_salary_information Table
Stores salary data:
```sql
AC-No.: "12345"
gross_salary: 50000.00
basic_salary: 30000.00
```

---

# CSV Upload Data Flow Documentation

## Overview
This document explains how data flows from CSV upload to the database, and how employees, addresses, policies, and salary information are created and managed.

### Key Principles
1. **csv_employees table is the SOURCE OF TRUTH** for employee identity
2. **All employee tables** synchronize with csv_employees via 4 CSV columns: `Emp No.`, `AC-No.`, `No.`, `Name`
3. **csv_employees stores UNIQUE employees only** (not cumulative across uploads)
4. **Job cards and reports** use `logs` table (raw CSV data) for display

---

## CSV Upload Flow

### Step 1: User Uploads CSV/Excel File
**Frontend**: `/csv-upload` page
**Backend Endpoint**: `POST /attendance/upload-csv`

**Supported Formats**:
- CSV files (`.csv`)
- Excel files (`.xls`, `.xlsx`) - automatically converted to CSV

**Required CSV Columns**:
- `Emp No.` - Employee number
- `AC-No.` - Access card number (primary identifier)
- `No.` - Employee code
- `Name` - Employee name
- `Auto-Assign` - Auto assignment flag
- `Date` - Attendance date (format: M/D/YYYY or MM/DD/YYYY)
- `Timetable` - Shift type
- `On duty` - Scheduled start time
- `Off duty` - Scheduled end time
- `Clock In` - Check-in time
- `Clock Out` - Check-out time
- `Normal` - Normal hours
- `Real time` - Real hours
- `Late` - Late duration
- `Early` - Early departure
- `Absent` - Absent flag
- `OT Time` - Overtime
- `Work Time` - Total work time
- `Exception` - Exceptions
- `Must C/In` - Must clock in
- `Must C/Out` - Must clock out
- `Department` - Department
- `NDays` - Normal days
- `WeekEnd` - Weekend days
- `Holiday` - Holiday days
- `ATT_Time` - Attendance time
- `NDays_OT` - Normal day OT
- `WeekEnd_OT` - Weekend OT
- `Holiday_OT` - Holiday OT

---

### Step 2: Backend Processing (`attendance.service.ts`)

#### 2.1 File Conversion (if Excel)
```
Excel File → convertExcelToCsv() → CSV File
```

#### 2.2 CSV Parsing
```
CSV File → processCsvFile() → Parse rows
```

#### 2.3 Per-Row Processing (for each attendance record)

**A. Extract Employee Information**
```typescript
empNo = record['Emp No.']
acNo = record['AC-No.']  // Primary identifier
empCode = record['No.']
name = record['Name']
department = record['Department']
clockIn = record['Clock In']
clockOut = record['Clock Out']
date = parseCsvDate(record['Date'])
```

**B. Calculate Late Time**
```typescript
calculatedLate = calculateLateForCsvImport(empCode, date, clockIn, name)
// Uses employee's shift policy (shift start time + grace period)
// NOT from CSV Late column
```

**C. Insert into `logs` Table** (Raw CSV Data)
```sql
INSERT INTO logs (
  Emp No., AC-No., No., Name, Auto-Assign, Date, Timetable,
  On duty, Off duty, Clock In, Clock Out, Normal, Real time,
  Late, calculated_late, Early, Absent, OT Time, Work Time, Exception,
  Must C/In, Must C/Out, Department, NDays, WeekEnd,
  Holiday, ATT_Time, NDays_OT, WeekEnd_OT, Holiday_OT, Status
) VALUES (...)
ON DUPLICATE KEY UPDATE ...
```
- **Purpose**: Store raw CSV data as backup
- **Used by**: Source for generating attendance table, historical records

**D. Insert into `csv_employees` Table** (Unique Employee List - NOT Cumulative)
```sql
INSERT INTO csv_employees (
  Emp No., AC-No., No., Name, Department, is_active
) VALUES (...)
ON DUPLICATE KEY UPDATE Name = ..., Department = ...
```
- **Purpose**: Maintain **UNIQUE** list of employees from CSV uploads
- **Important**: Stores only unique employees, NOT cumulative count
  - Example: Month 1 upload = 10 employees, Month 2 upload = 25 employees
  - Result: csv_employees contains 25 unique employees (not 35)
- **Used by**: All other modules as source of truth for employee identity
- **Primary Key**: `AC-No.` (unique)
- **Search Base**: All employee lookups start from this table

**E. Insert/Update `employees` Table** (Master Employee List)
```sql
-- Check if exists in csv_employees first (source of truth)
SELECT `AC-No.`, `No.`, `Name` FROM csv_employees WHERE `AC-No.` = ?

-- If exists, UPDATE/INSERT employees with CSV identity columns
INSERT INTO employees (
  `Emp No.`, `AC-No.`, `No.`, `Name`, emp_code, full_name_english, department
) VALUES (...)
ON DUPLICATE KEY UPDATE
  `Emp No.` = VALUES(`Emp No.`),
  `Name` = VALUES(`Name`),
  department = VALUES(department)
```
- **Purpose**: Master employee database with full profiles
- **Synced from**: `csv_employees` table (source of truth)
- **Common CSV Fields**: All employee tables must include `Emp No.`, `AC-No.`, `No.`, `Name`
- **Additional fields**: Designation, joining date, etc. (manual entry)

---

### Step 3: CSV Upload Behavior

**Important Rules**:
1. **logs table**: Stores ALL records from every CSV upload (cumulative if not cleared)
2. **csv_employees table**: Stores only UNIQUE employees (updates existing, adds new)
3. **attendance table**: Stores processed records from CSV upload

**Clear Logs Before Reupload (Optional)**
**Backend Endpoint**: `POST /attendance/clear-logs`

If you want to upload a new CSV file and replace old data:
1. Call `POST /attendance/clear-logs` to delete all records from `logs` table
2. Upload new CSV file
3. New data will be inserted into `logs` table
4. **csv_employees will maintain unique list** (updates existing employees, adds only new ones)

---

## Logs Table Structure (Single Source of Truth)

### Overview
The `logs` table now contains **BOTH** raw CSV data AND calculated/processed fields. This simplifies the architecture by using a single table for all attendance data.

### Table Columns

**CSV Raw Data Columns:**
- `Emp No.`, `AC-No.`, `No.`, `Name` - Employee identity
- `Date`, `Clock In`, `Clock Out` - Attendance timestamps
- `Status`, `Late`, `Early`, `Absent` - Attendance status
- `Department`, `Timetable`, `On duty`, `Off duty` - Work details
- `OT Time`, `Work Time`, `NDays`, `WeekEnd`, `Holiday` - OT and holidays
- All other original CSV columns

**Calculated Fields (NEW):**
- `emp_id` - Employee identifier
- `gross_salary`, `basic_salary`, `policy_type` - Salary information
- `shift_code`, `shift_start_time`, `shift_grace_minutes` - Shift details
- `late_minutes`, `calculated_late_minutes`, `actual_late` - Late calculations
- `late_deduction_policy`, `late_deduction_rule`, `late_count`, `late_deduction_days` - Late deductions
- `actual_absent`, `absent_deduction_amount`, `absent_deduction_policy` - Absent deductions
- `total_deduction_amount`, `total_late_count`, `total_absent_from_late` - Totals
- `day`, `month`, `year`, `attendance_date` - Parsed date fields
- `calculated_late` - Calculated late time based on shift policy

### Data Flow

```
CSV Upload → logs table (raw data + calculated fields in one table)
                                    ↓
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                   Job Cards Page        Salary Sheet Page
                   (/job-cards)          (/salary-sheet)
```

### Troubleshooting: Dashboard Shows 0 Records

**Symptom**: Job cards or salary sheet show no data
**Root Cause**: `logs` table is empty
**Solution**:
1. Check if logs table has data: `SELECT COUNT(*) FROM logs;`
2. If empty, upload CSV file via `/csv-upload`
3. Verify the date range in your query matches the data in logs table

---

## Manual Data Entry Flow

### After CSV Upload, Additional Data Must Be Entered Manually

The CSV upload only creates basic employee identity. Additional data is entered via admin panel pages:

---

### 1. Employee Address
**Frontend**: `/employee-address`
**Backend**: `employee-addresses` module
**Table**: `employee_addresses`

**Flow**:
```
User enters address via form → POST /employee-addresses
→ Lookup employee identity from csv_employees table
→ Insert into employee_addresses table
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- Present address
- Permanent address
- Phone, email, etc.

---

### 2. Employee Education
**Frontend**: `/employee-education`
**Backend**: `employee-education` module
**Table**: `employee_education`

**Flow**:
```
User enters education via form → POST /employee-education
→ Lookup employee identity from csv_employees table
→ Insert into employee_education table
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- Institution
- Degree
- Year
- Major

---

### 3. Employee Policy Tagging
**Frontend**: `/employee-policy-tagging`
**Backend**: `employee-policy-tagging` module
**Table**: `employee_policy_tagging`

**Flow**:
```
User assigns policies via form → POST /employee-policy-tagging
→ Lookup employee identity from csv_employees table
→ Insert into employee_policy_tagging table
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- `late_deduction_policy_rule` - APPLICABLE/N/A
- `absent_deduction_policy_rule` - ON_BASIC/ON_GROSS/N/A
- `shift_policy_rule` - Shift assignment

**Purpose**: These policies are used during CSV upload to calculate late/absent deductions

---

### 4. Employee Salary Information
**Frontend**: `/employee-salary-information`
**Backend**: `employee-salary-information` module
**Table**: `employee_salary_information`

**Flow**:
```
User enters salary via form → POST /employee-salary-information
→ Backend checks if salary record already exists (by AC-No. or No.)
→ If exists: Return error "Salary record already exists"
→ If new: Lookup employee identity from csv_employees table
→ Insert into employee_salary_information table
```

**Duplicate Prevention**:
- **Database Level**: `UNIQUE` constraint on `AC-No.` and `No.` columns
- **Backend Level**: Service validates before insert, throws `BadRequestException` if duplicate
- **Frontend Level**: On employee selection, checks for existing record and redirects to edit page

**Flow when duplicate detected**:
```
User selects employee from search
→ Frontend calls getByEmpCode() to check existing record
→ If record exists:
   → Show confirmation dialog
   → If user clicks "Edit": Redirect to `/employee-salary-information/{id}/edit`
   → If user clicks "Cancel": Show error message, stay on form
→ If no record: Proceed with new salary entry
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- `gross_salary`
- `basic_salary`
- `net_payable`
- Other salary components

**Purpose**: Used during CSV upload to populate `attendance.gross_salary` field

---

### 5. Employee Salary Bank Info
**Frontend**: `/employee-salary-bank-info` (if exists)
**Backend**: `employee-salary-bank-info` module
**Table**: `employee_salary_bank_info`

**Flow**:
```
User enters bank details via form → POST /employee-salary-bank-info
→ Lookup employee identity from csv_employees table
→ Insert into employee_salary_bank_info table
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- Bank name
- Account number
- Branch name

**Purpose**: Used in salary sheet for bank disbursement

---

### 6. Employee Salary Breakdown
**Frontend**: `/employee-salary-breakdown` (if exists)
**Backend**: `employee-salary-breakdown` module
**Table**: `employee_salary_breakdown`

**Flow**:
```
User enters salary components via form → POST /employee-salary-breakdown
→ Lookup employee identity from csv_employees table
→ Insert into employee_salary_breakdown table
```

**CSV Columns Used** (from csv_employees table):
- `Emp No.`
- `AC-No.`
- `No.`
- `Name`

**Manual Fields**:
- `payroll_head` - Allowance/deduction type
- `type` - Percentage/Fixed/Formula
- `amount`
- `percentage_formula`
- `base_head`
- `sequence`

**Purpose**: Detailed salary component breakdown for reports

---

## Salary Breakdown Calculation Structure

### Two Calculation Modes

The salary breakdown supports two calculation modes:

#### 1. Percentage Mode (New Structure)
Based on Gross Salary with the following breakdown:

| Component | Percentage | Calculation |
|-----------|------------|-------------|
| **Basic** | 50% | `Gross × 0.50` |
| **House Rent** | ~30% (remaining) | `Gross - Basic - Medical Allowance - Conveyance` |
| **Medical Allowance** | 15% | `Gross × 0.15` |
| **Conveyance** | 5% | `Gross × 0.05` |
| **Total** | 100% | - |

**Formula**:
```
Basic = Gross × 0.50
Medical Allowance = Gross × 0.15
Conveyance = Gross × 0.05
House Rent = Gross - Basic - Medical Allowance - Conveyance
```

#### 2. Formula Mode (Original Structure)
Uses fixed amounts with the original formula:

| Component | Fixed Amount | Type |
|-----------|--------------|------|
| **Medical Allowance** | 450 | Fixed |
| **Conveyance** | 2000 (1250 + 750) | Fixed |
| **Basic** | Calculated | Formula |
| **House Rent** | Calculated | Formula |

**Formula**:
```
Basic = (Gross - Fixed) / 1.5
House Rent = (Gross - Fixed) / 3
Where Fixed = 450 + 1250 + 750 = 2450
```

### Payroll Head Names

**Updated Names** (changed from old structure):
- `Medical` → `Medical Allowance`
- `Transport` + `Food` → `Conveyance` (combined)

**Complete List of Payroll Heads**:
- **Basic Structure**: Basic, House Rent, Medical Allowance, Conveyance, Stamp
- **Additions**: Attendance Bonus, Incentive, Performance Bonus
- **Deductions**: Provident Fund, Advance, Transport Deduction, Lunch Contribution, AIT, Punishment Amount

### Database Constraint (Prevent Duplicates)

To prevent duplicate salary breakdown rows when updating:

```sql
-- Unique constraint on employee + payroll head
ALTER TABLE employee_salary_breakdown
ADD UNIQUE INDEX idx_unique_emp_payroll (emp_code, payroll_head);
```

**Backend Update Logic**:
- Uses `REPLACE INTO` instead of `DELETE + INSERT`
- Atomically updates existing rows or inserts new ones
- Ensures only one row per employee per payroll head

### Salary Information Duplicate Prevention (Per Employee)

To prevent multiple salary records for the same employee:

**1. Database Level (SQL Constraints)**:
```sql
-- Add unique constraints to prevent duplicates
ALTER TABLE employee_salary_information
ADD CONSTRAINT uk_ac_no UNIQUE (`AC-No.`);

ALTER TABLE employee_salary_information
ADD CONSTRAINT uk_no UNIQUE (`No.`);
```

**2. Backend Level (Service Validation)**:
```typescript
// In EmployeeSalaryInformationService.create()
// Check if salary record already exists for this employee
const [existingRows] = await this.connection.execute(
  'SELECT id FROM employee_salary_information WHERE `AC-No.` = ? OR `No.` = ? LIMIT 1',
  [csvData.acNo, csvData.no]
);

if ((existingRows as any[]).length > 0) {
  throw new BadRequestException(
    `Salary record already exists for employee ${csvData.name}. Please update the existing record.`
  );
}
```

**3. Frontend Level (User Experience)**:
```typescript
// In handleEmployeeSelect()
const existing = await employeeSalaryInformationService.getByEmpCode(employee.emp_code);
if (existing && existing.id) {
  if (confirm(`Employee already has salary information. Edit existing record?`)) {
    router.push(`/employee-salary-information/${existing.id}/edit`);
  }
}
```

**Files Modified**:
- `backend/src/modules/employee-salary-information/employee-salary-information.service.ts` - Added duplicate check in create()
- `frontend/src/app/employee-salary-information/new/page.tsx` - Added redirect to edit page on duplicate
- `backend/database/add-unique-constraint-salary.sql` - Migration script for unique constraints
- `backend/database/cleanup-duplicate-salary.sql` - Cleanup script for existing duplicates

---

## Common CSV Columns Requirement

### All Employee Tables Must Include These 4 CSV Identity Columns

Every employee-related table in the system **MUST** include these columns from the CSV upload:

| Column | Description | Purpose |
|--------|-------------|---------|
| `Emp No.` | Employee number from CSV | Identity reference |
| `AC-No.` | Access card number from CSV | **PRIMARY lookup key** |
| `No.` | Employee code from CSV (e.g., E0453) | Secondary identifier |
| `Name` | Employee name from CSV | Display and search |

### Tables with Common CSV Columns

All these tables include the 4 CSV identity columns and synchronize with `csv_employees`:

1. **employees** - Master employee profiles
2. **employee_addresses** - Present/permanent addresses
3. **employee_education** - Education history
4. **employee_policy_tagging** - Policy assignments
5. **employee_salary_information** - Salary details
6. **employee_salary_bank_info** - Bank account details
7. **employee_salary_breakdown** - Salary components

### Synchronization Flow

```
CSV Upload → csv_employees (source of truth)
                │
                ├──→ employees (master profiles)
                ├──→ employee_addresses (addresses)
                ├──→ employee_education (education)
                ├──→ employee_policy_tagging (policies)
                ├──→ employee_salary_information (salary)
                ├──→ employee_salary_bank_info (bank)
                └──→ employee_salary_breakdown (components)
```

**Rule**: When searching for employees in any module, the search is performed against `csv_employees` table first, then linked to the specific module table via `AC-No.` or `No.`.

---

## Job Cards & Reports Flow

### Job Cards Use `logs` Table (Raw CSV Data)

**Frontend**: `/job-cards`
**Backend**: `attendance.service.ts` → `getJobCards()`
**Data Source**: `logs` table (raw CSV data, NOT attendance table)

**Flow**:
```
User selects date range → GET /attendance/job-cards
                      → Query logs table (raw CSV data)
                      → Calculate late using shift policies
                      → Group by employee
                      → Return job card data
```

**Why logs table?**
- Shows original CSV data exactly as uploaded
- Real-time calculation of late times based on current shift policies
- No dependency on attendance table population

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CSV Upload                                │
│                   /csv-upload page                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend: attendance.service.ts                      │
│                  processUploadFile()                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CSV Upload                                │
│                   /csv-upload page                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  logs table  │    │csv_employees │    │ attendance   │
│ (Raw CSV)    │    │   table      │    │   table      │
│ ───────────  │    │ ───────────  │    │ ───────────  │
│ All records  │    │ UNIQUE emp   │    │ Processed    │
│ Cumulative   │    │ only         │    │ with calc    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │                   ▼                   │
       │          ┌──────────────┐            │
       │          │   employees  │            │
       │          │   (Master)   │            │
       │          └──────────────┘            │
       │                                      │
       └──────────────────┬───────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  Job Cards   │
                   │  /reports    │
                   └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Manual Data Entry (After CSV Upload)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────┐
                    │csv_employees │
                    │  (lookup)    │
                    │  Source of   │
                    │   Truth      │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  employee_   │  │  employee_   │  │  employee_   │
│  addresses   │  │  education   │  │  policy_     │
│              │  │              │  │  tagging     │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  employee_   │  │  employee_   │  │  employee_   │
│  salary_     │  │  salary_     │  │  salary_     │
│  information │  │  bank_info   │  │  breakdown   │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Manual Data Entry                             │
│              (After CSV Upload)                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ employee_    │    │ employee_    │    │ employee_    │
│ addresses    │    │ education    │    │ policy_      │
│              │    │              │    │ tagging      │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │csv_employees │
                   │   (lookup)   │
                   └──────────────┘

        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ employee_    │    │ employee_    │    │ employee_    │
│ salary_      │    │ salary_      │    │ salary_      │
│ information  │    │ bank_info    │    │ breakdown    │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Key Points

### 1. Source of Truth for Employee Identity
- **`csv_employees` table** is the source of truth for employee identity
- All other modules (address, education, policy, salary) look up employee identity from this table
- The 4 CSV columns (`Emp No.`, `AC-No.`, `No.`, `Name`) are never manually edited - they come from CSV upload

### 2. CSV Upload Creates Basic Data Only
- CSV upload creates: raw attendance data in `logs` table, employee identity in `csv_employees` and `employees` tables
- CSV upload does NOT create: address, education, policy, salary information
- These must be entered manually via admin panel
- **Important**: CSV upload does NOT directly populate `attendance` table - `attendance` table is generated from `logs` table

### 3. Logs Table is Primary Source for Job Cards
- **`logs` table** contains raw CSV data with all columns
- **Job cards and reports** directly query `logs` table (not attendance table)
- `attendance` table is generated from `logs` table for salary calculations
- Before reuploading new CSV, use `POST /attendance/clear-logs` to delete old data from `logs` table

### 4. Policy Assignment is Required Before Generating Attendance
- For accurate late calculation in `attendance` table, assign policies to employees before generating attendance from logs
- Policies used during attendance generation:
  - `late_deduction_policy_rule` - How late deductions are calculated
  - `absent_deduction_policy_rule` - How absent deductions are calculated
  - `shift_policy_rule` - Which shift to use for late calculation

### 5. Salary Information is Required for Salary Sheet
- For salary sheet generation, enter salary information before generating reports
- Salary information used during attendance generation:
  - `gross_salary` - Stored in attendance table for salary calculations

### 6. Data Flow for Reports
```
CSV Upload → logs table ───────┬──────→ Job Cards/Reports
             (raw data)         │        (display raw data)
                                 │
                                 ▼
                         attendance table
                          (generated)
                              │
                              ▼
                        Salary Sheet
                     (calculated data)
```

---

## Recommended Workflow

### Step 1: Upload CSV First
1. Upload attendance CSV via `/csv-upload`
2. This creates employees in `csv_employees` and `employees` tables
3. Attendance data is stored in `logs` table (raw CSV data)

### Step 2: Assign Policies
1. Go to `/employee-policy-tagging`
2. Assign late/absent deduction policies to each employee
3. Assign shift policies

### Step 3: Enter Salary Information
1. Go to `/employee-salary-information`
2. Enter gross salary and other salary details for each employee

### Step 4: (Optional) Enter Additional Data
1. Go to `/employee-address` - Enter address details
2. Go to `/employee-education` - Enter education details
3. Go to `/employee-salary-bank-info` - Enter bank details
4. Go to `/employee-salary-breakdown` - Enter salary components

### Step 5: Generate Reports
1. Go to `/job-cards` - View daily attendance
2. Go to `/salary-sheet` - Generate salary reports

---

## Functions/Operations Using Logs Table

The `logs` table is the **single source of truth** used by the following functions in `attendance.service.ts`:

### Read Operations (SELECT FROM logs)

| Function | Purpose | Used By |
|----------|---------|---------|
| `loadFromLogsTable()` | Queries logs records with all fields (raw + calculated) | `getStats()`, `getJobCards()`, `getMonthlyData()` |
| `getSalaryAttendance(fromDate, toDate)` | Gets attendance summary for salary sheet with deductions | Salary Sheet page (`/salary-sheet`) |

### Write Operations (INSERT/UPDATE/DELETE)

| Function | SQL Operation | Purpose | Called When |
|----------|---------------|---------|-------------|
| `importCsvRecords()` | `INSERT INTO logs ... ON DUPLICATE KEY UPDATE` | Inserts/updates logs with raw CSV data + calculated fields | CSV Upload (`/csv-upload`) |
| `clearAllData()` | `DELETE FROM logs` | Clears all logs records | `POST /attendance/clear-logs` |

### Key Points:
- **Single Table Architecture**: All data (raw + calculated) stored in `logs` table only
- **Job Cards** use `logs` table directly
- **Salary Sheet** uses `logs` table directly with calculated fields
- **CSV Upload** populates `logs` table with both raw CSV data and calculated fields in one operation
- **No separate attendance table** - simplified architecture

---

### Step 6: Reupload CSV (Optional)
1. If you need to upload new CSV data, call `POST /attendance/clear-logs` to delete old data from `logs` table
2. Upload new CSV file via `/csv-upload`
3. New data will be inserted into `logs` table
4. Unique employees from new CSV will be updated in `csv_employees` table

---

## Database Table Relationships

```
csv_employees (Source of Truth)
    │
    ├── employees (Master employee list)
    │
    ├── employee_addresses (Address details)
    │
    ├── employee_education (Education details)
    │
    ├── employee_policy_tagging (Policy assignments)
    │
    ├── employee_salary_information (Salary data)
    │
    ├── employee_salary_bank_info (Bank details)
    │
    └── employee_salary_breakdown (Salary components)

logs (Raw CSV data - Source for attendance)
    └── Used to generate attendance table

attendance (Attendance records - Generated from logs)
    ├── Uses employee_policy_tagging for late/absent policies
    ├── Uses employee_salary_information for gross salary
    └── Uses shifts for shift info (start time, grace period)
```

---

# Database Schema Improvement & Migration Guide

## Overview

This section documents the **improved database schema** with proper foreign key relationships and deterministic employee identity resolution.

### Why This Migration is Needed

**Current Problems**:
1. **Unreliable Joins**: Multiple OR conditions on `AC-No.`, `No.`, `Emp No.` can produce incorrect matches
2. **No Referential Integrity**: No foreign key constraints to enforce data consistency
3. **Performance Issues**: Text-based joins without proper indexes
4. **Data Integrity Risk**: Orphan records and duplicate identities possible

**Solution**: Introduce `employee_id` as internal primary key with proper FK relationships.

---

## Improved Schema Architecture

### Core Principle: Deterministic Identity Resolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         csv_employees                                        │
│                    (SOURCE OF TRUTH)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  employee_id (PK, NEW)  │  AC-No. (UNIQUE)  │  No.  │  Name  │  Department │
└─────────────┬────────────────────────────────────────────────────────────────┘
              │
              │ 1:N via csv_employee_id (NEW)
              │
     ┌────────┴────────┬──────────────┬──────────────┬──────────────┐
     │                 │              │              │              │
     ▼                 ▼              ▼              ▼              ▼
┌──────────┐    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  logs    │    │  policy  │  │  salary  │  │   bank   │  │ breakdown│
│(attendance│    │(policies)│  │(salary  │  │ (bank   │  │(components│
│ records) │    │          │  │  info)   │  │  info)   │  │          │
└──────────┘    └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Key Changes

| Table | Before | After |
|-------|--------|-------|
| **csv_employees** | No internal PK | `employee_id` INT AUTO_INCREMENT PK |
| **logs** | Linked via text columns | `csv_employee_id` FK → csv_employees |
| **employee_policy_tagging** | Linked via text columns | `csv_employee_id` FK → csv_employees |
| **employee_salary_information** | Linked via text columns | `csv_employee_id` FK → csv_employees |
| **All related tables** | No FK constraints | FK constraints with CASCADE |

---

## Migration Plan (SAFE - Zero Data Loss)

### Phase 1: Validation (Read-Only - No Risk)

Run these scripts to validate current data before migration:

```bash
# 1. Check data integrity
mysql -u root -p attendance_db < backend/database/migrations/01_validate_current_data.sql

# 2. Find duplicate identities
mysql -u root -p attendance_db < backend/database/migrations/02_find_duplicate_identities.sql

# 3. Find orphan records
mysql -u root -p attendance_db < backend/database/migrations/03_find_orphan_records.sql
```

**Expected Results**:
- No duplicate `AC-No.` values in `csv_employees`
- Minimal orphan records (< 5% is acceptable)
- All identity columns populated

### Phase 2: Schema Enhancement (Low Risk - Additive Only)

**⚠️ BACKUP FIRST**:
```bash
mysqldump -u root -p attendance_db > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

**Execute migration**:
```bash
# 4. Add internal PK to source table
mysql -u root -p attendance_db < backend/database/migrations/04_add_employee_id_to_csv_employees.sql

# 5. Add FK columns to all related tables
mysql -u root -p attendance_db < backend/database/migrations/05_add_foreign_keys_to_related_tables.sql

# 6. Backfill FK relationships (most critical step)
mysql -u root -p attendance_db < backend/database/migrations/06_backfill_employee_ids.sql
```

### Phase 3: Performance & Constraints

```bash
# 7. Add performance indexes
mysql -u root -p attendance_db < backend/database/migrations/07_add_performance_indexes.sql

# 8. Add FK constraints (validates data integrity)
mysql -u root -p attendance_db < backend/database/migrations/08_add_foreign_key_constraints.sql
```

### Phase 4: Validation & Cleanup

```bash
# 9. Create simplified views
mysql -u root -p attendance_db < backend/database/migrations/09_create_employee_identity_view.sql

# 10. Validate migration results
mysql -u root -p attendance_db < backend/database/migrations/10_validate_migration_results.sql
```

---

## Query Pattern Changes

### BEFORE: Unreliable Multi-Column Joins (OLD CODE)

```typescript
// Problem: Multiple OR conditions can match wrong employees
const [rows] = await this.db.execute(
  `SELECT * FROM employee_policy_tagging ept
   JOIN logs l ON 
     ept.\`AC-No.\` = l.\`AC-No.\` 
     OR ept.\`No.\` = l.\`No.\`
     OR ept.\`Emp No.\` = l.\`Emp No.\`
   WHERE l.\`AC-No.\` = ?`,
  [acNo]
);
```

**Issues**:
- Can produce multiple matches (Cartesian product)
- No guarantee of correct employee
- Poor performance (no index utilization)

### AFTER: Deterministic FK Joins (NEW CODE)

```typescript
// Solution: Single FK join - always correct
const [rows] = await this.db.execute(
  `SELECT * FROM employee_policy_tagging ept
   JOIN logs l ON ept.csv_employee_id = l.csv_employee_id
   JOIN csv_employees ce ON ce.employee_id = ept.csv_employee_id
   WHERE ce.\`AC-No.\` = ?`,
  [acNo]
);
```

**Benefits**:
- Single, precise match guaranteed
- Optimal performance with indexes
- Enforced referential integrity

---

## Backend Code Updates Required

### 1. Update `attendance.service.ts`

**Location**: `backend/src/modules/attendance/attendance.service.ts`

**Change joins in `loadFromLogsTable()`** (around line 1276):

```typescript
// BEFORE (around line 1276-1287):
LEFT JOIN employee_policy_tagging ept ON 
  (ept.\`AC-No.\` = l.\`AC-No.\` OR ept.\`No.\` = l.\`No.\` OR ept.\`Emp No.\` = l.\`Emp No.\`)

// AFTER:
LEFT JOIN employee_policy_tagging ept ON ept.csv_employee_id = ce.employee_id
LEFT JOIN csv_employees ce ON l.csv_employee_id = ce.employee_id
```

### 2. Update Employee Lookup Methods

**Change `resolveEmployeeStrict()`** (around line 80):

```typescript
// Add FK-based lookup as primary method
private async resolveEmployeeByFK(csvEmployeeId: number): Promise<any | null> {
  const [rows] = await this.db.execute(
    `SELECT employee_id, \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, Department 
     FROM csv_employees 
     WHERE employee_id = ? 
     LIMIT 1`,
    [csvEmployeeId]
  );
  return (rows as any[]).length > 0 ? (rows as any[])[0] : null;
}
```

### 3. Update CSV Import to Populate FK

**In `importCsvRecords()`**, add FK population:

```typescript
// After getting employee from csv_employees
const csvEmployee = await this.getCsvEmployee(acNo, empCode);
const csvEmployeeId = csvEmployee?.employee_id;

// Include in INSERT
await this.db.execute(
  `INSERT INTO logs (
    csv_employee_id,  -- NEW
    \`AC-No.\`, \`No.\`, \`Emp No.\`, \`Name\`, ...
  ) VALUES (?, ?, ?, ?, ?, ...)`,
  [csvEmployeeId, acNo, empCode, empNo, name, ...]
);
```

---

## Validation Checklist

After migration, verify:

- [ ] **Phase 1 Complete**: No duplicate AC-No. values in csv_employees
- [ ] **Phase 2 Complete**: All tables have csv_employee_id column
- [ ] **Phase 2 Complete**: >95% of records have csv_employee_id populated
- [ ] **Phase 3 Complete**: All FK constraints created successfully
- [ ] **Phase 4 Complete**: Views created and working
- [ ] **Application Test**: Job Cards page loads correctly
- [ ] **Application Test**: Salary Sheet calculates correctly
- [ ] **Application Test**: CSV upload works with new FK column
- [ ] **Performance Test**: Reports load within acceptable time

---

## Rollback Plan

If issues occur, rollback is safe:

```sql
-- Remove FK constraints
ALTER TABLE logs DROP FOREIGN KEY fk_logs_employee;
ALTER TABLE employee_policy_tagging DROP FOREIGN KEY fk_policy_employee;
-- ... repeat for other tables

-- Remove FK columns (all original data preserved!)
ALTER TABLE logs DROP COLUMN csv_employee_id;
ALTER TABLE employee_policy_tagging DROP COLUMN csv_employee_id;
-- ... repeat for other tables

-- Remove internal PK from csv_employees
ALTER TABLE csv_employees DROP COLUMN employee_id;
```

**Result**: System returns to original state with all data intact.

---

## Migration Files Reference

| File | Purpose | Risk | Run Time |
|------|---------|------|----------|
| `01_validate_current_data.sql` | Check data integrity | None | Seconds |
| `02_find_duplicate_identities.sql` | Find identity conflicts | None | Seconds |
| `03_find_orphan_records.sql` | Find orphan records | None | Seconds |
| `04_add_employee_id_to_csv_employees.sql` | Add internal PK | Low | Seconds |
| `05_add_foreign_keys_to_related_tables.sql` | Add FK columns | Low | Seconds |
| `06_backfill_employee_ids.sql` | Populate FK values | Medium | Minutes |
| `07_add_performance_indexes.sql` | Add indexes | Low | Seconds |
| `08_add_foreign_key_constraints.sql` | Add FK constraints | Low | Seconds |
| `09_create_employee_identity_view.sql` | Create views | Low | Seconds |
| `10_validate_migration_results.sql` | Verify success | None | Seconds |

---

## Post-Migration Benefits

### Immediate Benefits
1. **Deterministic Relationships**: Single FK join always correct
2. **Data Integrity**: FK constraints prevent orphan records
3. **Performance**: Indexed integer joins vs text column scans
4. **Maintainability**: Simple, clear relationship model

### Long-term Benefits
1. **Scalability**: Consistent performance as data grows
2. **Reliability**: Enforced constraints prevent data corruption
3. **Development Speed**: Simpler queries, less debugging
4. **Reporting**: Clean views for complex reports

---

## Views for Simplified Queries

After migration, use these views for clean data access:

### vw_employee_identity
```sql
-- Clean employee lookup
SELECT * FROM vw_employee_identity WHERE ac_no = '12345';
```

### vw_employee_summary
```sql
-- Employee with related record counts
SELECT * FROM vw_employee_summary WHERE salary_records > 0;
```

### vw_employee_complete
```sql
-- All employee data in one query
SELECT * FROM vw_employee_complete WHERE employee_id = 1;
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: FK constraint fails during Phase 3
- **Cause**: Orphan records still exist
- **Solution**: Run `03_find_orphan_records.sql` and resolve orphans

**Issue**: Low link percentage in Phase 2.6
- **Cause**: Identity columns don't match between tables
- **Solution**: Check `02_find_duplicate_identities.sql` results

**Issue**: Application queries fail after migration
- **Cause**: Backend code still uses old join patterns
- **Solution**: Update service methods to use new FK joins

### Emergency Contacts
- Migration scripts: `backend/database/migrations/`
- Schema design: `IMPROVED_SCHEMA_DESIGN.md`
- Validation queries: Included in each migration file

---

## Summary

This migration provides:
- ✅ **Zero Data Loss**: All existing columns preserved
- ✅ **Backward Compatible**: System works during transition
- ✅ **Deterministic**: Single source of truth for identity
- ✅ **Safe**: Phased approach with validation at each step
- ✅ **Fast**: Indexed joins for optimal performance

Execute the migration scripts in order, validate at each phase, and enjoy a more reliable, maintainable database schema.

