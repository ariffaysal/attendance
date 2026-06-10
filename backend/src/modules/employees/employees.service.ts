import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { getAllEmployeeFields } from '../../config/employee.config';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

export interface Employee {
  id: number;
  // 4 Identity Columns (from csv_employees table - all stored, AC-No. is the lookup key)
  empNo: string;    // `Emp No.` from CSV
  acNo: string;     // `AC-No.` from CSV
  no: string;       // `No.` from CSV
  name: string;     // `Name` from CSV
  // Legacy fields
  emp_code: string;
  emp_id: string;
  punch_card: string;
  full_name_bangla: string;
  full_name_english: string;
  fathers_name_bangla?: string;
  fathers_name?: string;
  mothers_name_bangla?: string;
  mothers_name?: string;
  spouse_name_bangla?: string;
  spouse_name?: string;
  blood_group?: string;
  gender?: string;
  birth_place?: string;
  date_of_birth?: string;
  age?: string;
  religion?: string;
  marital_status?: string;
  nationality?: string;
  national_id: string;
  mobile_no: string;
  category: string;
  company: string;
  location: string;
  division?: string;
  department: string;
  section?: string;
  subsection?: string;
  designation_level?: string;
  designation: string;
  functional_superior?: string;
  leave_app_process_use: string;
  leave_approving_authority: string;
  admin_superior?: string;
  joining_date: string;
  provisional_tenor: string;
  remark?: string;
  created_at?: Date;
  updated_at?: Date;
}

@Injectable()
export class EmployeesService {
  private readonly fields: string[];

  constructor(@Inject(SQL_CONNECTION) private readonly db: mysql.Connection) {
    this.fields = getAllEmployeeFields();
  }

  async findAll(search?: string): Promise<Employee[]> {
    // Query from csv_employees to show the unique uploaded list
    // LEFT JOIN with employees to get extra details if they exist
    let query = `
      SELECT
        ce.id,
        ce.\`Emp No.\`,
        ce.\`AC-No.\`,
        ce.\`No.\`,
        ce.\`Name\`,
        ce.Department as department,
        e.full_name_english,
        e.full_name_bangla,
        e.designation,
        e.company,
        e.mobile_no,
        e.status
      FROM csv_employees ce
      LEFT JOIN employees e ON e.\`AC-No.\` = ce.\`AC-No.\`
      WHERE ce.is_active = TRUE
    `;
    const values: any[] = [];

    if (search) {
      query += ` AND (
        ce.\`AC-No.\` LIKE ? OR
        ce.\`Name\` LIKE ? OR
        e.full_name_english LIKE ? OR
        e.full_name_bangla LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY ce.\`AC-No.\` ASC';

    const [rows] = await this.db.execute(query, values);
    return (rows as any[]).map(row => this.transformToCamelCase(row));
  }

  async findById(id: number): Promise<Employee | null> {
    const [rows] = await this.db.execute(
      'SELECT * FROM employees WHERE id = ?',
      [id]
    );
    const employees = rows as Employee[];
    return employees[0] || null;
  }

  /**
   * Lookup employee from csv_employees table by AC-No.
   * Returns all 4 identity columns if found
   */
  private async lookupCsvEmployee(empCode: string): Promise<{empNo: string, acNo: string, no: string, name: string} | null> {
    // Try to find employee in csv_employees by various code formats
    const variations = [empCode];
    if (empCode.startsWith('E') && /^E\d+$/i.test(empCode)) {
      variations.push(`EMP${empCode.substring(1)}`);
      variations.push(empCode.substring(1));
      variations.push(String(parseInt(empCode.substring(1), 10)));
    } else if (!empCode.startsWith('EMP')) {
      variations.push(`EMP${empCode}`);
      variations.push(`E${empCode}`);
    }

    for (const codeVar of variations) {
      const [rows] = await this.db.execute(
        `SELECT \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\` 
         FROM csv_employees WHERE \`AC-No.\` = ? LIMIT 1`,
        [codeVar]
      );
      const csvEmps = rows as any[];
      if (csvEmps.length > 0) {
        const emp = csvEmps[0];
        return {
          empNo: emp['Emp No.'] || '',
          acNo: emp['AC-No.'] || '',
          no: emp['No.'] || '',
          name: emp['Name'] || ''
        };
      }
    }

    // Not found in CSV - return null (no auto-generation)
    return null;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    // Check for duplicates
    const [existingNationalId] = await this.db.execute(
      'SELECT id FROM employees WHERE national_id = ?',
      [dto.national_id]
    );
    if ((existingNationalId as any[]).length > 0) {
      throw new BadRequestException('National ID already exists');
    }

    const [existingMobile] = await this.db.execute(
      'SELECT id FROM employees WHERE mobile_no = ?',
      [dto.mobile_no]
    );
    if ((existingMobile as any[]).length > 0) {
      throw new BadRequestException('Mobile No already exists');
    }

    // Lookup all 4 identity columns from csv_employees (CSV is the source of truth)
    const csvEmp = await this.lookupCsvEmployee(dto.emp_code);

    const fields = this.fields;
    const placeholders = fields.map(() => '?').join(', ');
    // Map DTO values and handle CSV columns mapping
    const values = fields.map(field => {
      // CSV 4 identity columns come ONLY from csv_employees table (CSV upload)
      if (field === '`Emp No.`') return csvEmp?.empNo || '';
      if (field === '`AC-No.`') return csvEmp?.acNo || '';
      if (field === '`No.`') return csvEmp?.no || '';
      if (field === '`Name`') return csvEmp?.name || '';
      
      const val = dto[field as keyof CreateEmployeeDto];
      return val !== undefined && val !== null && val !== 'undefined' ? val : '';
    });

    const query = `INSERT INTO employees (${fields.join(', ')}, created_at) VALUES (${placeholders}, NOW())`;

    const [result] = await this.db.execute(query, values);
    const insertResult = result as mysql.ResultSetHeader;
    const newId = insertResult.insertId;

    return this.findById(newId) as Promise<Employee>;
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    // Check for duplicates (exclude current employee)
    if (dto.national_id && dto.national_id !== existing.national_id) {
      const [existingNationalId] = await this.db.execute(
        'SELECT id FROM employees WHERE national_id = ? AND id != ?',
        [dto.national_id, id]
      );
      if ((existingNationalId as any[]).length > 0) {
        throw new BadRequestException('National ID already exists');
      }
    }

    if (dto.mobile_no && dto.mobile_no !== existing.mobile_no) {
      const [existingMobile] = await this.db.execute(
        'SELECT id FROM employees WHERE mobile_no = ? AND id != ?',
        [dto.mobile_no, id]
      );
      if ((existingMobile as any[]).length > 0) {
        throw new BadRequestException('Mobile No already exists');
      }
    }

    const fields = this.fields;
    // Filter out CSV columns from update - they come from CSV only and never change
    const nonCsvFields = fields.filter(field => 
      field !== '`Emp No.`' && field !== '`AC-No.`' && field !== '`No.`' && field !== '`Name`'
    );
    const setClause = nonCsvFields.map(field => `${field} = ?`).join(', ');
    
    // Only update non-CSV fields from DTO
    const values = nonCsvFields.map(field => {
      const newValue = dto[field as keyof CreateEmployeeDto];
      const existingValue = existing[field as keyof Employee];
      const finalValue = newValue !== undefined && newValue !== null && newValue !== ''
        ? newValue
        : existingValue || '';
      return finalValue;
    });
    values.push(id.toString());

    const query = `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = ?`;

    try {
      const [result] = await this.db.execute(query, values);
      const updateResult = result as mysql.ResultSetHeader;
      
      if (updateResult.affectedRows === 0) {
        throw new Error('Database update failed - no rows affected');
      }
    } catch (dbError) {
      console.error('[SERVICE] Database error:', dbError);
      throw dbError;
    }

    return this.findById(id) as Promise<Employee>;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    await this.db.execute('DELETE FROM employees WHERE id = ?', [id]);
  }

  /**
   * Find employee by employee code (emp_code)
   * PRIORITIZES csv_employees table data (source of truth)
   * Then joins with employees table for additional details
   */
  async findByEmpCode(empCode: string): Promise<Employee | null> {
    // Find in csv_employees (source of truth for all 4 identity columns)
    // Search only by Name and AC-No.
    const [csvRows] = await this.db.execute(
      `SELECT
        ce.id, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`, ce.Department,
        e.designation, e.company, e.mobile_no, e.status
       FROM csv_employees ce
       LEFT JOIN employees e ON e.\`AC-No.\` = ce.\`AC-No.\`
       WHERE ce.\`AC-No.\` = ? OR ce.\`Name\` LIKE ?
       LIMIT 1`,
      [empCode, `%${empCode}%`]
    );

    const csvEmps = csvRows as any[];
    if (csvEmps.length > 0) {
      return this.transformToCamelCase(csvEmps[0]);
    }

    // No employee found
    return null;
  }

  /**
   * Search suggestions for autocomplete
   * Search by: Name or AC-No. only based on searchType
   * Returns all 4 identity fields: Emp No., AC-No., No., Name (for display)
   */
  async getSearchSuggestions(query: string, limit: number = 10, searchType?: string): Promise<any[]> {
    // Search from csv_employees table
    let rows: any[];

    if (!query || query.trim().length === 0) {
      const [result] = await this.db.execute(
        `SELECT id, \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`, Department
         FROM csv_employees
         WHERE is_active = TRUE
         ORDER BY \`AC-No.\` ASC
         LIMIT ?`,
        [limit]
      );
      rows = result as any[];
    } else {
      const searchTerm = `%${query}%`;
      let whereClause = '';
      let queryParams: any[] = [];

      if (searchType === 'acc_no') {
        // Search only by AC-No.
        whereClause = 'ce.`AC-No.` LIKE ?';
        queryParams = [searchTerm];
      } else {
        // Default: search by Name (or if searchType is 'name')
        whereClause = 'ce.`Name` LIKE ?';
        queryParams = [searchTerm];
      }

      const [result] = await this.db.execute(
        `SELECT ce.id, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`, ce.Department,
                e.designation, e.company, e.mobile_no, e.status
         FROM csv_employees ce
         LEFT JOIN employees e ON e.\`AC-No.\` = ce.\`AC-No.\`
         WHERE ce.is_active = TRUE AND (${whereClause})
         ORDER BY ce.\`AC-No.\` ASC
         LIMIT ?`,
        [...queryParams, limit]
      );
      rows = result as any[];
    }

    // Transform to include all 4 identity columns from csv_employees (for display)
    return rows.map(row => ({
      id: row.id,
      // 4 Identity Columns from csv_employees (source of truth)
      empNo: row['Emp No.'] || '',
      acNo: row['AC-No.'] || '',
      no: row['No.'] || '',
      name: row['Name'] || '',
      // Legacy fields (for backward compatibility)
      emp_code: row['AC-No.'] || '',
      emp_id: row['AC-No.'] || '',
      full_name_english: row['Name'] || '',
      department: row.Department,
      designation: row.designation || '',
      company: row.company || '',
      mobile_no: row.mobile_no || '',
      status: row.status || '',
    }));
  }

  /**
   * Lookup employee by any identifier (code, ID, or name)
   */
  async lookupEmployee(identifier: string): Promise<Employee | null> {
    const [rows] = await this.db.execute(
      `SELECT * FROM employees 
       WHERE emp_code = ? 
          OR emp_id = ? 
          OR full_name_english LIKE ?
          OR full_name_bangla LIKE ?
       LIMIT 1`,
      [identifier, identifier, `%${identifier}%`, `%${identifier}%`]
    );
    const employees = rows as Employee[];
    return employees[0] || null;
  }

  /**
   * Lookup employee by any identifier (code, ID, or name)
   */
  async findByIdentifier(identifier: string): Promise<Employee | null> {
    // Search by AC-No. or name
    const [rows] = await this.db.execute(
      `SELECT * FROM employees 
       WHERE \`AC-No.\` = ? 
          OR full_name_english LIKE ?
          OR full_name_bangla LIKE ?
       LIMIT 1`,
      [identifier, `%${identifier}%`, `%${identifier}%`]
    );
    
    const employees = rows as any[];
    return employees.length > 0 ? this.transformToCamelCase(employees[0]) : null;
  }

  // Transform database row (snake_case / CSV columns) to Employee interface (camelCase)
  private transformToCamelCase(row: any): Employee {
    if (!row) return null as any;
    // Get all 4 identity columns from CSV data
    const empNo = row['Emp No.'] || row.empNo || row.emp_no || '';
    const acNo = row['AC-No.'] || row.acNo || row.ac_no || row.punch_card || '';
    const no = row['No.'] || row.no || row.emp_code || '';
    const name = row['Name'] || row.name || row.full_name_english || row.full_name_bangla || '';
    return {
      id: row.id,
      // 4 Identity Columns (from csv_employees - all stored, AC-No. is the lookup key)
      empNo,
      acNo,
      no,
      name,
      // Legacy fields
      emp_code: no,
      emp_id: empNo,
      punch_card: acNo,
      full_name_bangla: name,
      full_name_english: name,
      fathers_name_bangla: row.fathers_name_bangla,
      fathers_name: row.fathers_name,
      mothers_name_bangla: row.mothers_name_bangla,
      mothers_name: row.mothers_name,
      spouse_name_bangla: row.spouse_name_bangla,
      spouse_name: row.spouse_name,
      blood_group: row.blood_group,
      gender: row.gender,
      birth_place: row.birth_place,
      date_of_birth: row.date_of_birth,
      age: row.age,
      religion: row.religion,
      marital_status: row.marital_status,
      nationality: row.nationality,
      national_id: row.national_id,
      mobile_no: row.mobile_no,
      category: row.category,
      company: row.company,
      location: row.location,
      division: row.division,
      department: row.department,
      section: row.section,
      subsection: row.subsection,
      designation_level: row.designation_level,
      designation: row.designation,
      functional_superior: row.functional_superior,
      leave_app_process_use: row.leave_app_process_use,
      leave_approving_authority: row.leave_approving_authority,
      admin_superior: row.admin_superior,
      joining_date: row.joining_date,
      provisional_tenor: row.provisional_tenor,
      remark: row.remark,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
