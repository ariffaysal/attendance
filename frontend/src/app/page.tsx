'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { attendanceService, SearchParams } from '@/services/attendance.service';
import { AttendanceStats } from '@/types/attendance';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { AttendanceTable } from '@/components/dashboard/AttendanceTable';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<AttendanceStats & { total: number }>({ present: 0, absent: 0, total: 0 });
  const [records, setRecords] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    currentPage: 1,
    totalPages: 1,
    perPage: 20,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentParams: SearchParams = {
    search: searchParams.get('search') || '',
    searchType: (searchParams.get('searchType') as any) || 'name',
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || '',
    page: parseInt(searchParams.get('page') || '1'),
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [searchParams, isAuthenticated]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [statsData, recordsData] = await Promise.all([
        attendanceService.getStats(currentParams),
        attendanceService.getRecords(currentParams),
      ]);
      setStats(statsData);
      setRecords(recordsData.records);
      setPagination({
        total: recordsData.total,
        currentPage: recordsData.currentPage,
        totalPages: recordsData.totalPages,
        perPage: recordsData.perPage,
      });
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Show loading while checking authentication
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <div>
          <h4 className="mb-1 fw-bold">Attendance Dashboard</h4>
          <p className="text-muted mb-0 small">
            View attendance records from CSV uploads
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-2">Loading attendance data...</p>
        </div>
      ) : (
        <>
          <SearchBar params={currentParams} />
          <StatsCards stats={stats} />
          <AttendanceTable
            records={records}
            pagination={pagination}
            loading={loading}
          />
          {records.length === 0 && !loading && (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5">
                <div className="mb-4">
                  <i className="fas fa-file-csv fa-4x text-primary opacity-50"></i>
                </div>
                <h5 className="text-muted mb-3">No Attendance Data</h5>
                <p className="text-muted mb-4">
                  Upload a CSV file via the Upload CSV page to import attendance data.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push('/csv-upload')}
                >
                  <i className="fas fa-upload me-2"></i>Upload CSV
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
