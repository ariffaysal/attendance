import { api } from './api';

// Updated interface to match backend CSV 4 columns
export interface CsvEmployee {
  id: number;
  empNo: string;       // `Emp No.` from CSV
  acNo: string;        // `AC-No.` from CSV - PRIMARY lookup key
  no: string;          // `No.` from CSV
  name: string;        // `Name` from CSV - Search by this
  department: string;
  isActive: boolean;
  policyTaggingId: number | null;
  createdAt: string;
  updatedAt: string;
}

export const csvEmployeeService = {
  /**
   * Get all CSV employees with optional search
   * Searches by Name only
   */
  async getAll(search?: string): Promise<CsvEmployee[]> {
    const response = await api.get('/attendance/csv-employees', {
      params: { search }
    });
    return response.data;
  },

  /**
   * Get a single CSV employee by AC-No. (primary lookup key)
   */
  async getByACNo(acNo: string): Promise<CsvEmployee | null> {
    const response = await api.get(`/attendance/csv-employees/ac-no/${acNo}`);
    return response.data;
  },

  /**
   * Alias for backward compatibility
   * @deprecated Use getByACNo instead
   */
  async getByCode(empCode: string): Promise<CsvEmployee | null> {
    return this.getByACNo(empCode);
  },

  /**
   * Lookup CSV employee by any identifier (Emp No., AC-No., No., or Name)
   * Returns the 4 CSV columns and department info
   */
  async lookup(identifier: string): Promise<{
    empNo: string;
    acNo: string;
    no: string;
    name: string;
    department: string;
  } | null> {
    const response = await api.get(`/attendance/csv-employees/lookup/${encodeURIComponent(identifier)}`);
    return response.data;
  },
};
