'use client';

import { useState, useEffect } from 'react';
import { attendanceService, RealtimeLog } from '@/services/attendance.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { publicApiUrl } from '@/services/api';

export default function LiveAttendancePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [punches, setPunches] = useState<RealtimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [notifications, setNotifications] = useState<{id: number; message: string; type: 'success'|'info'}[]>([]);

  // Fix hydration error - set date only on client
  useEffect(() => {
    setLastRefresh(new Date());
  }, []);

  // Show notification helper
  const showNotification = (message: string, type: 'success'|'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load punches
  async function loadPunches() {
    try {
      const data = await attendanceService.getTodayPunches();
      setPunches(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load punches:', err);
    } finally {
      setLoading(false);
    }
  }

  // WebSocket connection for real-time punches
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[LiveAttendance] Connecting to WebSocket at', `${publicApiUrl}/attendance`);
    
    const newSocket = io(`${publicApiUrl}/attendance`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[LiveAttendance] WebSocket connected');
      setIsWebSocketConnected(true);
      
      // Subscribe to attendance updates
      newSocket.emit('subscribe_attendance');
    });

    newSocket.on('disconnect', () => {
      console.log('[LiveAttendance] WebSocket disconnected');
      setIsWebSocketConnected(false);
    });

    // Listen for new attendance events
    newSocket.on('new_attendance', (data) => {
      console.log('[LiveAttendance] New punch received:', data);
      
      // Add new punch to the list
      const newPunch: RealtimeLog = {
        id: Date.now(), // Temporary ID
        device_user_id: data.empCode || data.userId,
        emp_code: data.empCode,
        employee_name: data.employee,
        punch_time: data.time,
        verify_type: data.verifyType || 'Fingerprint',
        status: data.status,
        device_ip: '',
        processed: 0,
        created_at: new Date().toISOString(),
      };
      
      setPunches(prev => [newPunch, ...prev]);
      setLastRefresh(new Date());
      
      // Show notification for new punch
      showNotification(`✅ ${data.employee || data.userId} punched at ${data.time}`, 'success');
      
      // Play notification sound (optional)
      // new Audio('/notification.mp3').play().catch(() => {});
    });

    // Listen for device connection status
    newSocket.on('device_connection_status', (status) => {
      console.log('[LiveAttendance] Device status:', status);
      setDeviceConnected(status.connected);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('[LiveAttendance] Cleaning up WebSocket...');
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Initial load of existing punches
  useEffect(() => {
    if (isAuthenticated) {
      loadPunches();
    }
  }, [isAuthenticated]);

  // Fallback: Auto-refresh every 5 seconds if WebSocket not connected
  useEffect(() => {
    if (!isAutoRefresh || !isAuthenticated || isWebSocketConnected) return;

    const interval = setInterval(() => {
      loadPunches();
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, isAuthenticated, isWebSocketConnected]);

  // Calculate stats
  const checkIns = punches.filter(p => p.status === 'CheckIn').length;
  const checkOuts = punches.filter(p => p.status === 'CheckOut').length;
  const uniqueEmployees = new Set(punches.map(p => p.device_user_id)).size;

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <nav className="navbar navbar-dark bg-dark shadow-sm">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="fas fa-broadcast-tower me-2 text-success"></i>
            Live Attendance
            {isWebSocketConnected && (
              <span className="badge bg-success ms-2">
                <i className="fas fa-circle me-1"></i>LIVE
              </span>
            )}
          </span>
          <div className="d-flex align-items-center gap-3">
            {/* Connection Status */}
            <div className="d-flex flex-column align-items-end me-3">
              <span className="text-light small">
                <i className={`fas fa-circle me-1 ${isWebSocketConnected ? 'text-success' : 'text-danger'}`}></i>
                WebSocket: {isWebSocketConnected ? 'Connected' : 'Disconnected'}
              </span>
              <span className="text-light small">
                <i className={`fas fa-circle me-1 ${deviceConnected ? 'text-success' : 'text-warning'}`}></i>
                Device: {deviceConnected ? 'Connected' : 'Unknown'}
              </span>
            </div>
            <span className="text-light small border-start ps-3">
              <i className="fas fa-clock me-1"></i>
              {lastRefresh?.toLocaleTimeString() || '--:--:--'}
            </span>
            <button
              className={`btn btn-sm ${isAutoRefresh ? 'btn-success' : 'btn-outline-light'}`}
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              <i className={`fas ${isAutoRefresh ? 'fa-pause' : 'fa-play'} me-1`}></i>
              {isAutoRefresh ? 'Pause' : 'Auto-refresh'}
            </button>
            <button className="btn btn-sm btn-outline-light" onClick={() => router.push('/')}>
              <i className="fas fa-arrow-left me-1"></i>
              Back
            </button>
          </div>
        </div>
      </nav>

      {/* Notifications */}
      <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
        {notifications.map(n => (
          <div key={n.id} className={`alert alert-${n.type === 'success' ? 'success' : 'info'} alert-dismissible fade show shadow`} role="alert">
            <i className={`fas ${n.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'} me-2`}></i>
            {n.message}
            <button type="button" className="btn-close" onClick={() => setNotifications(prev => prev.filter(nf => nf.id !== n.id))} aria-label="Close"></button>
          </div>
        ))}
      </div>

      <div className="container-fluid py-4">
        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card bg-success text-white border-0 shadow-sm">
              <div className="card-body text-center">
                <h3 className="mb-1">{punches.length}</h3>
                <small>Total Punches Today</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-primary text-white border-0 shadow-sm">
              <div className="card-body text-center">
                <h3 className="mb-1">{uniqueEmployees}</h3>
                <small>Unique Employees</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white border-0 shadow-sm">
              <div className="card-body text-center">
                <h3 className="mb-1">{checkIns}</h3>
                <small>Check-ins</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white border-0 shadow-sm">
              <div className="card-body text-center">
                <h3 className="mb-1">{checkOuts}</h3>
                <small>Check-outs</small>
              </div>
            </div>
          </div>
        </div>

        {/* Live Punches Table */}
        <div className="card border-0 shadow">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="fas fa-bolt me-2 text-success"></i>
              Real-time Punches
              {isAutoRefresh && (
                <span className="badge bg-success ms-2">
                  <i className="fas fa-circle me-1"></i>LIVE
                </span>
              )}
            </h5>
            <button className="btn btn-sm btn-outline-primary" onClick={loadPunches}>
              <i className="fas fa-sync-alt me-1"></i>Refresh Now
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted mt-2">Loading live attendance...</p>
              </div>
            ) : punches.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="fas fa-inbox fa-3x mb-3"></i>
                <p>No punches recorded today</p>
                <small>Punches will appear here automatically when employees use the device</small>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>#</th>
                      <th>Employee Name</th>
                      <th>Device ID</th>
                      <th>Time</th>
                      <th>Verify Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {punches.map((punch, index) => (
                      <tr key={punch.id} className={index === 0 ? 'table-success' : ''}>
                        <td className="text-muted">{punches.length - index}</td>
                        <td className="fw-semibold">
                          {punch.employee_name || 'Unknown'}
                          {index === 0 && (
                            <span className="badge bg-success ms-2">
                              <i className="fas fa-arrow-down"></i> Latest
                            </span>
                          )}
                        </td>
                        <td>#{punch.device_user_id}</td>
                        <td>{new Date(punch.punch_time).toLocaleTimeString()}</td>
                        <td>
                          <i className={`fas fa-${punch.verify_type === 'Fingerprint' ? 'fingerprint' : 'id-card'} me-1`}></i>
                          {punch.verify_type}
                        </td>
                        <td>
                          <span className={`badge ${punch.status === 'CheckIn' ? 'bg-success' : 'bg-warning'}`}>
                            <i className={`fas fa-${punch.status === 'CheckIn' ? 'sign-in-alt' : 'sign-out-alt'} me-1`}></i>
                            {punch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Instructions & Troubleshooting */}
        <div className="row">
          <div className="col-md-6">
            <div className="alert alert-info" role="alert">
              <h6 className="alert-heading">
                <i className="fas fa-info-circle me-2"></i>How to Use Live Attendance
              </h6>
              <ul className="mb-0 small">
                <li><strong>WebSocket Connected (Green)</strong> = Punches will appear instantly</li>
                <li><strong>WebSocket Disconnected (Red)</strong> = Uses auto-refresh every 5 seconds</li>
                <li>Latest punch is highlighted in green at the top</li>
                <li>Use <strong>Sync Device Users</strong> on dashboard to import employee names</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className={`alert ${deviceConnected ? 'alert-success' : 'alert-warning'}`} role="alert">
              <h6 className="alert-heading">
                <i className="fas fa-plug me-2"></i>Device Connection Status
              </h6>
              <ul className="mb-0 small">
                <li><strong>Device:</strong> {deviceConnected ? 'Connected and listening for punches' : 'Status unknown - check dashboard'}</li>
                <li><strong>WebSocket:</strong> {isWebSocketConnected ? 'Connected to backend' : 'Disconnected - check backend'}</li>
                {!deviceConnected && (
                  <li className="text-danger fw-bold">⚠️ Go to Dashboard → Check if device is connected</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
