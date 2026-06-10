# Improved Database Schema Design

## Executive Summary

This document presents the **improved database schema** for the Attendance Management System with:
- **Single Primary Identity** (`employee_id`) for deterministic relationships
- **Proper Foreign Key Constraints** for referential integrity
- **Zero Data Loss** migration path
- **Backward Compatibility** maintained during transition

---

## Core Design Principles

### 1. Single Source of Truth
- **csv_employees** remains the authoritative employee identity table
- **AC-No.** remains the business key (external identifier from CSV)
- **employee_id** is the new internal primary key (auto-increment integer)

### 2. Deterministic Relationships
- All related tables link via `csv_employee_id` → `csv_employees.employee_id`
- **NO MORE** unreliable multi-column OR joins
- **NO MORE** guessing logic based on name or partial matches

### 3. Zero Data Loss
- All existing columns preserved (`AC-No.`, `No.`, `Emp No.`, `Name`)
- New columns added alongside existing data
- Backward compatible during transition period

### 4. Performance Optimized
- Strategic indexes on foreign keys and common query patterns
- Composite indexes for date-range queries
- Views for simplified access patterns

---

## Improved Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           csv_employees                                     │
│                    (SOURCE OF TRUTH - Identity)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  employee_id (PK)  │  AC-No. (UNIQUE)  │  No.  │  Name  │  Department      │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           │ 1:N relationships via csv_employee_id
           │
    ┌──────┴──────┬──────────────┬──────────────┬──────────────┐
    │             │              │              │              │
    ▼             ▼              ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  logs    │ │  policy  │ │  salary  │ │   bank   │ │ breakdown│
│(attendance│ │(policies)│ │(salary  │ │ (bank   │ │(components│
│ records) │ │          │ │  info)   │ │  info)   │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## Table-by-Table Design

### 1. csv_employees (Source of Truth)

```sql
CREATE TABLE csv_employees (
    -- NEW: Internal Primary Key
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- EXISTING: Business Keys (unchanged)
    `AC-No.` VARCHAR(50) UNIQUE,     -- Primary business key
    `No.` VARCHAR(50),               -- Employee code
    `Emp No.` VARCHAR(50) UNIQUE,    -- Alternative identifier
    `Name` VARCHAR(200),             -- Display name
    
    -- Additional Info
    Department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_employee_id (employee_id),
    UNIQUE KEY uk_ac_no (`AC-No.`),
    UNIQUE KEY uk_emp_no (`Emp No.`),
    INDEX idx_name (`Name`)
);
```

**Purpose**: Single source of truth for employee identity. All other tables reference this via `employee_id`.

---

### 2. logs (Attendance Records)

```sql
CREATE TABLE logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- NEW: Foreign Key to csv_employees
    csv_employee_id INT,
    
    -- EXISTING: CSV Raw Data (preserved)
    `Emp No.` VARCHAR(50),
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Name` VARCHAR(200),
    `Date` VARCHAR(20),
    `Clock In` VARCHAR(10),
    `Clock Out` VARCHAR(10),
    ... -- other CSV columns
    
    -- EXISTING: Calculated Fields
    calculated_late VARCHAR(10),
    late_minutes INT,
    actual_late DECIMAL(5,2),
    gross_salary DECIMAL(10,2),
    shift_code VARCHAR(50),
    attendance_date DATE,
    ... -- other calculated fields
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- NEW: Foreign Key Constraint
    CONSTRAINT fk_logs_employee 
        FOREIGN KEY (csv_employee_id) 
        REFERENCES csv_employees(employee_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_csv_employee_id (csv_employee_id),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_employee_date (csv_employee_id, attendance_date),  -- Composite for date-range queries
    INDEX idx_ac_no (`AC-No.`),  -- Kept for backward compatibility
    INDEX idx_no (`No.`)
);
```

**Purpose**: Stores both raw CSV data AND calculated fields. Deterministically linked to employee via FK.

---

### 3. employee_policy_tagging

```sql
CREATE TABLE employee_policy_tagging (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- NEW: Foreign Key
    csv_employee_id INT NOT NULL,
    
    -- EXISTING: Identity columns (preserved for reference)
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Emp No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Policy Fields
    shift_policy_rule VARCHAR(50),
    late_deduction_policy_rule VARCHAR(50),
    absent_deduction_policy_rule VARCHAR(50),
    ... -- other policy fields
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- NEW: Foreign Key Constraint
    CONSTRAINT fk_policy_employee 
        FOREIGN KEY (csv_employee_id) 
        REFERENCES csv_employees(employee_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_csv_employee_id (csv_employee_id),
    INDEX idx_shift_policy (csv_employee_id, shift_policy_rule)
);
```

**Purpose**: Links employees to attendance/salary policies. **DELETE CASCADE**: When employee deleted, policies are also deleted.

---

### 4. employee_salary_information

```sql
CREATE TABLE employee_salary_information (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- NEW: Foreign Key
    csv_employee_id INT NOT NULL,
    
    -- EXISTING: Identity columns (preserved)
    `AC-No.` VARCHAR(50),
    `No.` VARCHAR(50),
    `Emp No.` VARCHAR(50),
    `Name` VARCHAR(200),
    
    -- Salary Fields
    gross_salary VARCHAR(50),
    basic_salary VARCHAR(50),
    net_payable VARCHAR(50),
    ... -- other salary fields
    
    -- NEW: Deduction Columns
    absent_amount VARCHAR(50) DEFAULT '0.00',
    late_deduct VARCHAR(50) DEFAULT '0.00',
    final_payable VARCHAR(50) DEFAULT '0.00',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- NEW: Foreign Key Constraint
    CONSTRAINT fk_salary_employee 
        FOREIGN KEY (csv_employee_id) 
        REFERENCES csv_employees(employee_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_csv_employee_id (csv_employee_id),
    UNIQUE KEY uk_employee_salary (csv_employee_id)  -- One salary record per employee
);
```

**Purpose**: Stores employee salary information. One record per employee enforced by unique constraint.

---

### 5. Supporting Tables

All supporting tables follow the same pattern:
- `csv_employee_id` INT as foreign key
- Existing identity columns preserved (`AC-No.`, `No.`, `Emp No.`, `Name`)
- FK constraint to `csv_employees(employee_id)`
- Index on `csv_employee_id`

**Tables**:
- `employee_salary_bank_info` - Bank account details
- `employee_salary_breakdown` - Salary components
- `employees` - Master employee profiles
- `employee_addresses` - Contact information
- `employee_education` - Qualification records

---

## Query Pattern Changes

### BEFORE: Unreliable Joins (OLD CODE)
```typescript
// Multiple OR conditions - can produce incorrect matches
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

**Problems**:
- Multiple OR conditions create Cartesian products
- Can match wrong employees if codes overlap
- No guarantee of single, correct match

---

### AFTER: Deterministic Joins (NEW CODE)
```typescript
// Single FK join - always correct, always one match
const [rows] = await this.db.execute(
  `SELECT * FROM employee_policy_tagging ept
   JOIN logs l ON ept.csv_employee_id = l.csv_employee_id
   JOIN csv_employees ce ON ce.employee_id = ept.csv_employee_id
   WHERE ce.\`AC-No.\` = ?`,
  [acNo]
);
```

**Benefits**:
- Single, precise join condition
- Guaranteed correct employee match
- Optimal query performance with indexes

---

## Key Improvements Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Primary Key** | None (AC-No. used loosely) | `employee_id` (auto-increment) |
| **Relationships** | Unreliable multi-column OR joins | Deterministic FK joins |
| **Data Integrity** | No enforcement | FK constraints enforced |
| **Performance** | Full table scans on text columns | Indexed integer joins |
| **Maintainability** | Complex join logic | Simple FK relationships |
| **Scalability** | Degrades with data growth | Scales with proper indexes |

---

## Migration Safety

### Phase 1: Validation (Read-Only)
- Check current data integrity
- Identify duplicates and orphans
- **Zero risk** - only reports issues

### Phase 2: Schema Enhancement (Additive Only)
- Add `employee_id` to csv_employees
- Add `csv_employee_id` to all related tables
- Backfill foreign key values
- **Low risk** - only adds columns, no data loss

### Phase 3: Constraints (Enforcement)
- Add performance indexes
- Add FK constraints (validates data integrity)
- **Low risk** - validates what Phase 2 established

### Phase 4: Cleanup (Optional)
- Create simplified views
- Update application code
- Remove old join logic
- **Low risk** - application-level changes

---

## Rollback Plan

If issues occur, rollback is straightforward:

```sql
-- Remove FK constraints
ALTER TABLE logs DROP FOREIGN KEY fk_logs_employee;
ALTER TABLE employee_policy_tagging DROP FOREIGN KEY fk_policy_employee;
-- ... etc for other tables

-- Remove FK columns (original columns preserved!)
ALTER TABLE logs DROP COLUMN csv_employee_id;
ALTER TABLE employee_policy_tagging DROP COLUMN csv_employee_id;
-- ... etc for other tables

-- Remove internal PK from csv_employees
ALTER TABLE csv_employees DROP COLUMN employee_id;
```

**All original data remains intact** - only the new columns are removed.

---

## Performance Expectations

### Before Migration
- Joins: O(n*m) complexity due to OR conditions
- No index utilization for multi-column matches
- Degrading performance as data grows

### After Migration
- Joins: O(log n) with indexed integer FK
- Optimal index utilization
- Consistent performance regardless of data size

---

## Views for Simplified Access

### vw_employee_identity
Clean employee lookup:
```sql
SELECT * FROM vw_employee_identity WHERE ac_no = '12345';
```

### vw_employee_summary
Employee with record counts:
```sql
SELECT * FROM vw_employee_summary WHERE salary_records > 0;
```

### vw_employee_complete
All employee data joined:
```sql
SELECT * FROM vw_employee_complete WHERE employee_id = 1;
```

---

## Conclusion

This improved schema provides:
- **Deterministic** employee relationships
- **Reliable** data integrity with FK constraints
- **Optimized** query performance
- **Safe** migration path with zero data loss
- **Maintainable** codebase with simple join logic

The migration can be executed incrementally with validation at each phase, ensuring production safety.
