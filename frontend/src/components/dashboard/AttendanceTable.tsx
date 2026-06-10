'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface AttendanceRecord {
  status: string;
  empNo: string;
  acNo: string;
  no: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string;
  late: string;
  department: string;
}

interface AttendanceTableProps {
  records: (string[] | AttendanceRecord)[];
  pagination: {
    total: number;
    currentPage: number;
    totalPages: number;
    perPage: number;
  };
  loading: boolean;
}

export function AttendanceTable({ records, pagination, loading }: AttendanceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('page', page.toString());
    router.push(`?${newParams.toString()}`);
  };

  if (loading) {
    return <div className="text-center py-5">Loading...</div>;
  }

  // Helper to get value from either array or object format
  const getValue = (r: string[] | AttendanceRecord, field: string): string => {
    if (Array.isArray(r)) {
      // Old array format indices
      const indices: Record<string, number> = {
        status: 0, empNo: 1, acNo: 2, no: 3, name: 4, date: 6,
        clockIn: 10, clockOut: 11, late: 14, department: 22
      };
      return r[indices[field]] || '';
    }
    // New object format
    return (r as AttendanceRecord)[field as keyof AttendanceRecord] || '';
  };

  return (
    <div className="card table-container border-0 shadow-sm">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold">
          <i className="fas fa-list me-2 text-primary"></i>Attendance Logs
        </h5>
        <span className="badge bg-light text-dark">
          {records.length} of {pagination.total} records
        </span>
      </div>
      
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Status</th>
              <th>Emp No.</th>
              <th>Name</th>
              <th>Date</th>
              <th>In Time</th>
              <th>Out Time</th>
              <th>Late</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={idx}>
                <td>
                  <span className={`badge rounded-pill px-3 ${getValue(r, 'status') === 'Present' ? 'badge-present' : 'badge-absent'}`}>
                    {getValue(r, 'status')}
                  </span>
                </td>
                <td className="fw-medium">#{getValue(r, 'no')}</td>
                <td className="fw-semibold text-dark">{getValue(r, 'name')}</td>
                <td>{getValue(r, 'date')}</td>
                <td className="text-success fw-medium">{getValue(r, 'clockIn') || '--:--'}</td>
                <td className="text-danger fw-medium">{getValue(r, 'clockOut') || '--:--'}</td>
                <td>
                  {getValue(r, 'late') && getValue(r, 'late') !== '00:00' ? (
                    <span className="text-warning fw-bold small">{getValue(r, 'late')}</span>
                  ) : (
                    <span className="text-muted small">-</span>
                  )}
                </td>
                <td className="text-muted small">{getValue(r, 'department') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {pagination.totalPages > 1 && (
        <div className="card-footer bg-white d-flex justify-content-center">
          <nav>
            <ul className="pagination mb-0">
              <li className={`page-item ${pagination.currentPage === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => goToPage(pagination.currentPage - 1)}>Previous</button>
              </li>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                <li key={page} className={`page-item ${pagination.currentPage === page ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => goToPage(page)}>{page}</button>
                </li>
              ))}
              <li className={`page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => goToPage(pagination.currentPage + 1)}>Next</button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
