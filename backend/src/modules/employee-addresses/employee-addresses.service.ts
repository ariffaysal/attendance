import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { SQL_CONNECTION } from '../../database/database.module';
import { CreateEmployeeAddressDto, UpdateEmployeeAddressDto } from './dto/create-employee-address.dto';

@Injectable()
export class EmployeeAddressesService {
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
      // Local record emp_code (for reference)
      empCode: row['No.'] || row.no || row.emp_code || '',
      category: row.category,
      company: row.company,
      location: row.location,
      divisionOrg: row.division_org,
      department: row.department,
      section: row.section,
      subsection: row.subsection,
      designation: row.designation,
      presentVillageArea: row.present_village_area,
      presentHouseNo: row.present_house_no,
      presentRoadNo: row.present_road_no,
      presentPostOfficeCode: row.present_post_office_code,
      presentThana: row.present_thana,
      presentDistrict: row.present_district,
      presentDivisionGeo: row.present_division_geo,
      presentLandPhone: row.present_land_phone,
      presentCellPhone: row.present_cell_phone,
      presentEmail: row.present_email,
      isSameAsPresent: row.is_same_as_present === 1,
      permanentVillageArea: row.permanent_village_area,
      permanentHouseNo: row.permanent_house_no,
      permanentRoadNo: row.permanent_road_no,
      permanentPostOfficeCode: row.permanent_post_office_code,
      permanentThana: row.permanent_thana,
      permanentDistrict: row.permanent_district,
      permanentDivisionGeo: row.permanent_division_geo,
      permanentLandPhone: row.permanent_land_phone,
      permanentCellPhone: row.permanent_cell_phone,
      permanentEmail: row.permanent_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(search?: string): Promise<any[]> {
    let query = `
      SELECT ea.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
      FROM employee_addresses ea
      LEFT JOIN csv_employees ce ON ea.emp_code = ce.\`No.\` OR ea.emp_code = ce.\`AC-No.\`
    `;
    const params: any[] = [];

    if (search) {
      query += `
        WHERE ce.\`Name\` LIKE ? 
           OR ce.\`AC-No.\` LIKE ?
      `;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY ce.`Name` ASC';

    const [rows] = await this.connection.execute(query, params);
    return (rows as any[]).map(row => this.transformToCamelCase(row));
  }

  async findOne(id: number): Promise<any> {
    // Join with csv_employees to get the correct CSV 4 columns (source of truth)
    const [rows] = await this.connection.execute(
      `SELECT ea.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
       FROM employee_addresses ea
       LEFT JOIN csv_employees ce ON ea.emp_code = ce.\`No.\` OR ea.emp_code = ce.\`AC-No.\`
       WHERE ea.id = ?`,
      [id],
    );
    
    const addresses = rows as any[];
    if (addresses.length === 0) {
      throw new NotFoundException('Employee address not found');
    }
    return this.transformToCamelCase(addresses[0]);
  }

  async findByEmpCode(empCode: string): Promise<any | null> {
    // Join with csv_employees to get the correct CSV 4 columns (source of truth)
    const [rows] = await this.connection.execute(
      `SELECT ea.*, ce.\`Emp No.\`, ce.\`AC-No.\`, ce.\`No.\`, ce.\`Name\`
       FROM employee_addresses ea
       LEFT JOIN csv_employees ce ON ea.emp_code = ce.\`No.\` OR ea.emp_code = ce.\`AC-No.\`
       WHERE ea.\`AC-No.\` = ? OR ea.\`No.\` = ?`,
      [empCode, empCode],
    );
    
    const addresses = rows as any[];
    return addresses.length > 0 ? this.transformToCamelCase(addresses[0]) : null;
  }

  async findByACNo(acNo: string): Promise<any | null> {
    // Same logic as findByEmpCode - search by AC-No. or No.
    return this.findByEmpCode(acNo);
  }

  /**
   * Lookup the 4 CSV columns from csv_employees table
   * Returns empty strings if not found (no auto-generation)
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

  async create(dto: CreateEmployeeAddressDto): Promise<any> {
    // Lookup 4 CSV columns from csv_employees (CSV is the source of truth)
    const csvData = await this.lookupCsvColumns(dto.empCode);
    
    // Check for duplicate using AC-No.
    if (csvData.acNo) {
      const existing = await this.findByEmpCode(csvData.acNo);
      if (existing) {
        throw new Error('Employee address already exists for this AC-No.');
      }
    }

    const sql = `
      INSERT INTO employee_addresses (
        emp_code,
        \`Emp No.\`, \`AC-No.\`, \`No.\`, \`Name\`,
        category, company, location, division_org, department, section, subsection, designation,
        present_village_area, present_house_no, present_road_no, present_post_office_code, present_thana,
        present_district, present_division_geo, present_land_phone, present_cell_phone, present_email,
        is_same_as_present, permanent_village_area, permanent_house_no, permanent_road_no, permanent_post_office_code,
        permanent_thana, permanent_district, permanent_division_geo, permanent_land_phone, permanent_cell_phone, permanent_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // CSV columns come ONLY from csv_employees table
    const values = [
      dto.empCode || null,
      csvData.empNo || null,
      csvData.acNo || null,
      csvData.no || null,
      csvData.name || null,
      dto.category || null,
      dto.company || null,
      dto.location || null,
      dto.divisionOrg || null,
      dto.department || null,
      dto.section || null,
      dto.subsection || null,
      dto.designation || null,
      dto.presentVillageArea || null,
      dto.presentHouseNo || null,
      dto.presentRoadNo || null,
      dto.presentPostOfficeCode || null,
      dto.presentThana || null,
      dto.presentDistrict || null,
      dto.presentDivisionGeo || null,
      dto.presentLandPhone || null,
      dto.presentCellPhone || null,
      dto.presentEmail || null,
      dto.isSameAsPresent ? 1 : 0,
      dto.permanentVillageArea || null,
      dto.permanentHouseNo || null,
      dto.permanentRoadNo || null,
      dto.permanentPostOfficeCode || null,
      dto.permanentThana || null,
      dto.permanentDistrict || null,
      dto.permanentDivisionGeo || null,
      dto.permanentLandPhone || null,
      dto.permanentCellPhone || null,
      dto.permanentEmail || null,
    ];

    const [result] = await this.connection.execute(sql, values);
    const insertId = (result as mysql.OkPacket).insertId;
    return this.findOne(insertId);
  }

  async update(id: number, dto: UpdateEmployeeAddressDto): Promise<any> {
    const existing = await this.findOne(id);
    
    // Get raw row for update
    const [existingRows] = await this.connection.execute(
      'SELECT * FROM employee_addresses WHERE id = ?',
      [id],
    );
    const rawExisting = (existingRows as any[])[0];

    const sql = `
      UPDATE employee_addresses SET
        category = ?,
        company = ?,
        location = ?,
        division_org = ?,
        department = ?,
        section = ?,
        subsection = ?,
        designation = ?,
        present_village_area = ?,
        present_house_no = ?,
        present_road_no = ?,
        present_post_office_code = ?,
        present_thana = ?,
        present_district = ?,
        present_division_geo = ?,
        present_land_phone = ?,
        present_cell_phone = ?,
        present_email = ?,
        is_same_as_present = ?,
        permanent_village_area = ?,
        permanent_house_no = ?,
        permanent_road_no = ?,
        permanent_post_office_code = ?,
        permanent_thana = ?,
        permanent_district = ?,
        permanent_division_geo = ?,
        permanent_land_phone = ?,
        permanent_cell_phone = ?,
        permanent_email = ?
      WHERE id = ?
    `;

    // CSV columns (Emp No., AC-No., No., Name) are NOT updated - they remain from CSV
    const values = [
      dto.category !== undefined ? dto.category : rawExisting.category,
      dto.company !== undefined ? dto.company : rawExisting.company,
      dto.location !== undefined ? dto.location : rawExisting.location,
      dto.divisionOrg !== undefined ? dto.divisionOrg : rawExisting.division_org,
      dto.department !== undefined ? dto.department : rawExisting.department,
      dto.section !== undefined ? dto.section : rawExisting.section,
      dto.subsection !== undefined ? dto.subsection : rawExisting.subsection,
      dto.designation !== undefined ? dto.designation : rawExisting.designation,
      dto.presentVillageArea !== undefined ? dto.presentVillageArea : rawExisting.present_village_area,
      dto.presentHouseNo !== undefined ? dto.presentHouseNo : rawExisting.present_house_no,
      dto.presentRoadNo !== undefined ? dto.presentRoadNo : rawExisting.present_road_no,
      dto.presentPostOfficeCode !== undefined ? dto.presentPostOfficeCode : rawExisting.present_post_office_code,
      dto.presentThana !== undefined ? dto.presentThana : rawExisting.present_thana,
      dto.presentDistrict !== undefined ? dto.presentDistrict : rawExisting.present_district,
      dto.presentDivisionGeo !== undefined ? dto.presentDivisionGeo : rawExisting.present_division_geo,
      dto.presentLandPhone !== undefined ? dto.presentLandPhone : rawExisting.present_land_phone,
      dto.presentCellPhone !== undefined ? dto.presentCellPhone : rawExisting.present_cell_phone,
      dto.presentEmail !== undefined ? dto.presentEmail : rawExisting.present_email,
      dto.isSameAsPresent !== undefined ? (dto.isSameAsPresent ? 1 : 0) : rawExisting.is_same_as_present,
      dto.permanentVillageArea !== undefined ? dto.permanentVillageArea : rawExisting.permanent_village_area,
      dto.permanentHouseNo !== undefined ? dto.permanentHouseNo : rawExisting.permanent_house_no,
      dto.permanentRoadNo !== undefined ? dto.permanentRoadNo : rawExisting.permanent_road_no,
      dto.permanentPostOfficeCode !== undefined ? dto.permanentPostOfficeCode : rawExisting.permanent_post_office_code,
      dto.permanentThana !== undefined ? dto.permanentThana : rawExisting.permanent_thana,
      dto.permanentDistrict !== undefined ? dto.permanentDistrict : rawExisting.permanent_district,
      dto.permanentDivisionGeo !== undefined ? dto.permanentDivisionGeo : rawExisting.permanent_division_geo,
      dto.permanentLandPhone !== undefined ? dto.permanentLandPhone : rawExisting.permanent_land_phone,
      dto.permanentCellPhone !== undefined ? dto.permanentCellPhone : rawExisting.permanent_cell_phone,
      dto.permanentEmail !== undefined ? dto.permanentEmail : rawExisting.permanent_email,
      id,
    ];

    await this.connection.execute(sql, values);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.connection.execute(
      'DELETE FROM employee_addresses WHERE id = ?',
      [id],
    );
  }
}
