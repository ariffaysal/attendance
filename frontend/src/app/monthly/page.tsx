'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { attendanceService, SearchParams } from '@/services/attendance.service';
import { MonthlySegment } from '@/types/attendance';
import { SearchBar } from '@/components/dashboard/SearchBar';

export default function MonthlyPage() {
  const searchParams = useSearchParams();
  const [segments, setSegments] = useState<MonthlySegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentParams: SearchParams = {
    search: searchParams.get('search') || '',
    searchType: (searchParams.get('searchType') as any) || 'general',
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || '',
  };

  useEffect(() => {
    loadData();
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceService.getMonthlyData(currentParams);
      setSegments(data);
    } catch (err: any) {
      console.error('Failed to load monthly data:', err);
      setError(err.message || 'Failed to load monthly data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading monthly reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Monthly Reports</h4>
          <p className="text-muted mb-0 small">View monthly attendance reports</p>
        </div>
        <div className="d-flex gap-2">
          <SearchBar params={currentParams} />
          <button onClick={() => window.print()} className="btn btn-outline-dark">
            <i className="fas fa-print me-2"></i> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {segments.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="mb-4">
              <i className="fas fa-search fa-3x text-muted opacity-50"></i>
            </div>
            <h5 className="text-muted mb-3">No Records Found</h5>
            <p className="text-muted mb-0">No attendance records match your search criteria.</p>
          </div>
        </div>
      ) : (
        segments.map((segment) => (
          <div key={segment.ym} className="report-paper shadow-lg mb-5">
            <div className="report-header">
              <h2 className="fw-bold mb-0">MONTHLY ATTENDANCE SHEET</h2>
              <p className="text-muted">
                Year: {segment.year} | Month: {segment.month}
              </p>
            </div>

              {segment.employees.map((employee, empIdx) => {
                const daysInMonth = new Date(segment.year, new Date(Date.parse(segment.month + ' 1, 2000')).getMonth() + 1, 0).getDate();
                return (
                <div key={`${employee.acNo}-${empIdx}`} className="mb-5" style={{ pageBreakInside: 'avoid' }}>
                  <div className="d-flex align-items-center mb-3">
                    <h5 className="mb-0 fw-bold text-primary">
                      {employee.name} (AC-No.: {employee.acNo})
                    </h5>
                  </div>

                <div className="table-responsive">
                  <table className="table table-bordered table-sm">
                    <thead className="table-dark">
                      <tr>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={`day-header-${i + 1}`} className="text-center" style={{ width: '3%' }}>
                            {i + 1}
                          </th>
                        ))}
                        <th className="text-center bg-success text-white">P</th>
                        <th className="text-center bg-danger text-white">A</th>
                        <th className="text-center bg-warning">Late</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {employee.records.slice(0, daysInMonth).map((day, idx) => (
                          <td
                            key={`day-cell-${idx + 1}`}
                            className={`text-center ${
                              day.status === 'P'
                                ? 'bg-success bg-opacity-10 text-success fw-bold'
                                : day.status === 'A'
                                ? 'bg-danger bg-opacity-10 text-danger fw-bold'
                                : ''
                            }`}
                          >
                            {day.status !== '-' ? day.status : ''}
                          </td>
                        ))}
                        <td className="text-center fw-bold text-success">{employee.present}</td>
                        <td className="text-center fw-bold text-danger">{employee.absent}</td>
                        <td className="text-center fw-bold text-warning">{employee.late}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="row mt-3 text-muted small">
                  <div className="col">
                    <strong>In Time:</strong>{' '}
                    {employee.records.find((r) => r.in !== '00:00')?.in || '-'}
                  </div>
                  <div className="col">
                    <strong>Out Time:</strong>{' '}
                    {employee.records.find((r) => r.out !== '00:00')?.out || '-'}
                  </div>
                  <div className="col">
                    <strong>OT:</strong>{' '}
                    {employee.records.find((r) => r.ot !== '0')?.ot || '0'}
                  </div>
                </div>
              </div>
            );})}
          </div>
        ))
      )}
    </div>
  );
}
