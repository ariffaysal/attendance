'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { attendanceService, SearchParams, RealtimeLog } from '@/services/attendance.service';
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
  const [todayPunches, setTodayPunches] = useState<RealtimeLog[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    currentPage: 1,
    totalPages: 1,
    perPage: 20,
  });
  const [loading, setLoading] = useState(true);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [notifications, setNotifications] = useState<{id: number; message: string; type: 'success'|'info'|'error'}[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Show notification helper
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const currentParams: SearchParams = {
    search: searchParams.get('search') || '',
    searchType: (searchParams.get('searchType') as any) || 'general',
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
      loadTodayPunches();
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

  async function loadTodayPunches() {
    try {
      const punches = await attendanceService.getTodayPunches();
      setTodayPunches(punches);
    } catch (err) {
      console.error('Failed to load today punches:', err);
    }
  }

  const handleSyncUsersToDb = async () => {
    setSyncingUsers(true);
    setError(null);
    try {
      const result = await attendanceService.syncDeviceUsersToDb();
      
      if (result.newEmployees > 0) {
        showNotification(`✅ Synced ${result.newEmployees} new users from device`, 'success');
      } else if (result.totalDeviceUsers === 0) {
        showNotification(`⚠️ No users found on device`, 'info');
      } else {
        showNotification(`ℹ️ All ${result.totalDeviceUsers} users already exist in database`, 'info');
      }
      
      // Reload users list if on users page
      window.dispatchEvent(new CustomEvent('users-synced'));
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to sync device users to database';
      setError(errorMsg);
      showNotification(`❌ ${errorMsg}`, 'error');
    } finally {
      setSyncingUsers(false);
    }
  };

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
          <h4 className="mb-1 fw-bold">Real-Time Attendance Dashboard</h4>
          <p className="text-muted mb-0 small">
            Live data from ZKTeco K40 Device
          </p>
          <p className="text-warning mb-0 small mt-1">
            <i className="fas fa-info-circle me-1"></i>
            Note: Close official ZKTeco software before syncing. Device allows only one connection at a time.
          </p>
        </div>
        <div className="d-flex gap-2 flex-shrink-0" style={{ whiteSpace: 'nowrap' }}>
          <button
            className="btn btn-outline-primary"
            onClick={() => router.push('/users')}
            title="View all users from device"
          >
            <i className="fas fa-users me-2"></i>View Users
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSyncUsersToDb}
            disabled={syncingUsers}
            title="Import all users from ZKTeco device to employees database"
          >
            {syncingUsers ? (
              <><i className="fas fa-spinner fa-spin me-2"></i>Syncing...</>
            ) : (
              <><i className="fas fa-sync me-2"></i>Sync Device Users</>
            )}
          </button>
        </div>
      </div>

      {/* Notifications - Fixed at top-right */}
      <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999, maxWidth: '400px' }}>
        {notifications.map(n => {
          const alertClass = n.type === 'success' ? 'success' : n.type === 'error' ? 'danger' : 'info';
          const iconClass = n.type === 'success' ? 'fa-check-circle' : n.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
          return (
            <div key={n.id} className={`alert alert-${alertClass} alert-dismissible fade show shadow mb-2`} role="alert">
              <i className={`fas ${iconClass} me-2`}></i>
              <small>{n.message}</small>
              <button type="button" className="btn-close btn-sm" onClick={() => setNotifications(prev => prev.filter(nf => nf.id !== n.id))} aria-label="Close"></button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

      {/* Today's Live Punches */}
      {todayPunches.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0 fw-bold text-success">
              <i className="fas fa-bolt me-2"></i>Today's Live Punches ({todayPunches.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>Device ID</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayPunches.slice(0, 5).map((punch) => (
                    <tr key={punch.id}>
                      <td className="fw-semibold">{punch.employee_name || 'Unknown'}</td>
                      <td>#{punch.device_user_id}</td>
                      <td>{new Date(punch.punch_time).toLocaleTimeString()}</td>
                      <td>{punch.verify_type}</td>
                      <td>
                        <span className={`badge ${punch.status === 'CheckIn' ? 'bg-success' : 'bg-warning'}`}>
                          {punch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                  <i className="fas fa-fingerprint fa-4x text-primary opacity-50"></i>
                </div>
                <h5 className="text-muted mb-3">No Attendance Data</h5>
                <p className="text-muted mb-4">
                  Use "Sync Device Users" button to import users from the device to the employee database.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
