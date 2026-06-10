import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { CreateEmployeeEducationDto, UpdateEmployeeEducationDto } from './dto/create-employee-education.dto';

@Injectable()
export class EmployeeEducationService {
  constructor(
    @Inject(SQL_CONNECTION) private connection: mysql.Connection,
  ) {}

  // Transform snake_case DB results to camelCase for API
  private transformToCamelCase(row: any): any {
    if (!row) return null;
    return {
      id: row.id,
      // CSV 4 identity columns from csv_employees (PRIORITY)
      empNo: row['Emp No.'] || row.emp_no || row.empNo || '',
      acNo: row['AC-No.'] || row.ac_no || row.acNo || '',
      no: row['No.'] || row.no || '',
      name: row['Name'] || row.name || '',
      // Local record fields (fallback)
      empCode: row.emp_code || row['AC-No.'] || row['No.'] || '',
      empId: row.emp_id || row['Emp No.'] || '',
      empName: row.emp_name || row['Name'] || '',
      category: row.category,
      company: row.company,
      location: row.location,
      division: row.division,
      department: row.department,
      section: row.section,
      subsection: row.subsection,
      designation: row.designation,
      courseName: row.course_name,
      board: row.board,
      institution: row.institution,
      discipline: row.discipline,
      majorSubject: row.major_subject,
      year: row.year,
      result: row.result,
      educationNature: row.education_nature,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(search?: string): Promise<any[]> {
    let query = `
      SELECT ee.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
      FROM employee_education ee
      LEFT JOIN csv_employees ce ON ee.emp_code = ce.\`No.\` OR ee.emp_code = ce.\`AC-No.\`
    `;
    const params: any[] = [];

    if (search) {
      query += `
        WHERE ce.\`Name\` LIKE ? 
           OR ce.\`AC-No.\` LIKE ?
           OR ee.course_name LIKE ?
           OR ee.institution LIKE ?
      `;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY ce.`Name` ASC';

    const [rows] = await this.connection.execute(query, params);
    return (rows as any[]).map(row => this.transformToCamelCase(row));
  }

  async findOne(id: number): Promise<any> {
    // Join with csv_employees to get the correct CSV 4 columns (source of truth)
    const [rows] = await this.connection.execute(
      `SELECT ee.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
       FROM employee_education ee
       LEFT JOIN csv_employees ce ON ee.emp_code = ce.\`No.\` OR ee.emp_code = ce.\`AC-No.\`
       WHERE ee.id = ?`,
      [id],
    );
    
    const educations = rows as any[];
    if (educations.length === 0) {
      throw new NotFoundException('Employee education not found');
    }
    return this.transformToCamelCase(educations[0]);
  }

  async findByEmpCode(empCode: string): Promise<any[]> {
    // Join with csv_employees to get the correct CSV 4 columns (source of truth)
    const [rows] = await this.connection.execute(
      `SELECT ee.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
       FROM employee_education ee
       LEFT JOIN csv_employees ce ON ee.emp_code = ce.\`No.\` OR ee.emp_code = ce.\`AC-No.\`
       WHERE ee.\`AC-No.\` = ? OR ee.\`No.\` = ?
       ORDER BY ee.created_at DESC`,
      [empCode, empCode],
    );
    
    const educations = rows as any[];
    return educations.map(row => this.transformToCamelCase(row));
  }

  /**
   * Lookup the 4 CSV columns from csv_employees table
   */
  private async lookupCsvColumns(empCode: string): Promise<{ empNo: string; acNo: string; no: string; name: string }> {
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
      const [rows] = await this.connection.execute(
        `SELECT \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\` FROM csv_employees WHERE \`AC-No.\` = ? OR \`No.\` = ? LIMIT 1`,
        [codeVar, codeVar]
      );
      const csvEmps = rows as any[];
      if (csvEmps.length > 0) {
        return {
          empNo: csvEmps[0]['Emp No.'] || '',
          acNo: csvEmps[0]['AC-No.'] || '',
          no: csvEmps[0]['No.'] || '',
          name: csvEmps[0]['Name'] || ''
        };
      }
    }

    return { empNo: '', acNo: '', no: '', name: '' };
  }

  async create(dto: CreateEmployeeEducationDto): Promise<any> {
    const sql = `
      INSERT INTO employee_education (
        \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`,
        emp_code, emp_id, emp_name,
        category, company, location, division, department, 
        section, subsection, designation, course_name, board, institution, discipline, 
        major_subject, year, result, education_nature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // CSV columns come from frontend (already validated)
    const values = [
      dto.empNo || dto.empId || null,    // Emp No. from frontend
      dto.acNo || dto.empCode || null,  // AC-No. from frontend
      dto.no || dto.empCode || null,    // No. from frontend
      dto.name || dto.empName || null,  // Name from frontend
      dto.empCode || null,                // emp_code for compatibility
      dto.empId || null,                  // emp_id for compatibility
      dto.empName || null,                // emp_name for compatibility
      dto.category || null,
      dto.company || null,
      dto.location || null,
      dto.division || null,
      dto.department || null,
      dto.section || null,
      dto.subsection || null,
      dto.designation || null,
      dto.courseName || null,
      dto.board || null,
      dto.institution || null,
      dto.discipline || null,
      dto.majorSubject || null,
      dto.year || null,
      dto.result || null,
      dto.educationNature || 'Academic',
    ];

    const [result] = await this.connection.execute(sql, values);
    const insertId = (result as mysql.OkPacket).insertId;
    return this.findOne(insertId);
  }

  async update(id: number, dto: UpdateEmployeeEducationDto): Promise<any> {
    await this.findOne(id);
    
    const [existingRows] = await this.connection.execute(
      'SELECT * FROM employee_education WHERE id = ?',
      [id],
    );
    const rawExisting = (existingRows as any[])[0];

    const sql = `
      UPDATE employee_education SET
        category = ?,
        company = ?,
        location = ?,
        division = ?,
        department = ?,
        section = ?,
        subsection = ?,
        designation = ?,
        course_name = ?,
        board = ?,
        institution = ?,
        discipline = ?,
        major_subject = ?,
        year = ?,
        result = ?,
        education_nature = ?
      WHERE id = ?
    `;

    // CSV columns (Emp No., AC-No., No., Name) are NOT updated - they remain from CSV
    const values = [
      dto.category !== undefined ? dto.category : rawExisting.category,
      dto.company !== undefined ? dto.company : rawExisting.company,
      dto.location !== undefined ? dto.location : rawExisting.location,
      dto.division !== undefined ? dto.division : rawExisting.division,
      dto.department !== undefined ? dto.department : rawExisting.department,
      dto.section !== undefined ? dto.section : rawExisting.section,
      dto.subsection !== undefined ? dto.subsection : rawExisting.subsection,
      dto.designation !== undefined ? dto.designation : rawExisting.designation,
      dto.courseName !== undefined ? dto.courseName : rawExisting.course_name,
      dto.board !== undefined ? dto.board : rawExisting.board,
      dto.institution !== undefined ? dto.institution : rawExisting.institution,
      dto.discipline !== undefined ? dto.discipline : rawExisting.discipline,
      dto.majorSubject !== undefined ? dto.majorSubject : rawExisting.major_subject,
      dto.year !== undefined ? dto.year : rawExisting.year,
      dto.result !== undefined ? dto.result : rawExisting.result,
      dto.educationNature !== undefined ? dto.educationNature : rawExisting.education_nature,
      id,
    ];

    await this.connection.execute(sql, values);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.connection.execute(
      'DELETE FROM employee_education WHERE id = ?',
      [id],
    );
  }
}
