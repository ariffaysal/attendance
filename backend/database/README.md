# Database Setup Instructions

## Quick Setup

### Option 1: Run Individual Table Files
Run these SQL files in order in phpMyAdmin (SQL tab):

```sql
-- 1. Core Tables
source employees.sql
source attendance.sql
source logs.sql

-- 2. Employee Related Tables  
source employee-addresses.sql
source employee-education.sql
source employee-policy-tagging.sql
source employee-salary-information.sql

-- 3. Authentication
source auth-users.sql

-- 4. Library/Reference Data
source library.sql
```

### Option 2: Run All Tables at Once
```sql
source database.sql  -- Contains all core tables
source database/employee-education.sql
source database/employee-policy-tagging.sql
source database/employee-salary-information.sql
source database/library.sql
source database/auth-users.sql
```

## Table Summary

| File | Tables Created | Description |
|------|----------------|-------------|
| `employees.sql` | employees | Master employee records |
| `attendance.sql` | attendance | Monthly attendance reports |
| `logs.sql` | logs | Raw CSV upload data |
| `employee-addresses.sql` | employee_addresses | Present & permanent addresses |
| `employee-education.sql` | employee_education | Academic records |
| `employee-policy-tagging.sql` | employee_policy_tagging | Policy assignments |
| `employee-salary-information.sql` | employee_salary_information, employee_salary_bank_info, employee_salary_breakdown | Salary details |
| `auth-users.sql` | auth_users | Login credentials |
| `library.sql` | library_policies, library_policy_rules | Reference policies |

## Total Tables: 11

1. `employees`
2. `attendance`
3. `logs`
4. `employee_addresses`
5. `employee_education`
6. `employee_policy_tagging`
7. `employee_salary_information`
8. `employee_salary_bank_info`
9. `employee_salary_breakdown`
10. `auth_users`
11. `library_policies`
12. `library_policy_rules`

## Auto-Created Tables

**Note:** The backend auto-creates these on startup:
- `logs`
- `employee_addresses`
- `employee_education`
- `auth_users`

**Manual Required:** Run the other SQL files for:
- `employees`
- `attendance`
- `employee_policy_tagging`
- `employee_salary_information` (3 tables)
- `library_policies` + `library_policy_rules`






