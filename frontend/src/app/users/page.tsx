'use client';

import { useState, useEffect } from 'react';
import { attendanceService } from '@/services/attendance.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function UsersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load users
  async function loadUsers() {
    try {
      setLoading(true);
      console.log('Fetching users from /attendance/users...');
      const data = await attendanceService.getAllUsers();
      console.log('Users loaded:', data);
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      alert('Error loading users: ' + (err.message || 'Network error. Check console for details.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
    }
  }, [isAuthenticated]);

  // Sort users by emp_id (device_user_id) numerically
  const sortedUsers = [...users].sort((a, b) => {
    const idA = parseInt(a.emp_id) || 0;
    const idB = parseInt(b.emp_id) || 0;
    return idA - idB;
  });

  // Filter users by search
  const filteredUsers = sortedUsers.filter(user => 
    user.full_name_english?.toLowerCase().includes(search.toLowerCase()) ||
    user.emp_code?.toLowerCase().includes(search.toLowerCase()) ||
    user.emp_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <nav className="navbar navbar-dark bg-primary shadow-sm">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="fas fa-users me-2"></i>
            Device Users ({users.length})
          </span>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-light" onClick={loadUsers}>
              <i className="fas fa-sync me-1"></i>Refresh
            </button>
            <button className="btn btn-sm btn-outline-light" onClick={() => router.push('/')}>
              <i className="fas fa-arrow-left me-1"></i>Back
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid py-4">
        {/* Search */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="fas fa-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, employee code, or device ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="fas fa-id-card me-2 text-primary"></i>
              All Users
            </h5>
            <span className="badge bg-primary">{filteredUsers.length} users</span>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted mt-3">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-users-slash fa-3x text-muted mb-3"></i>
                <p className="text-muted">
                  {search ? 'No users match your search' : 'No users found. Click "Sync Device Users" on dashboard to import from device.'}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="px-4">#</th>
                      <th>Device ID</th>
                      <th>Employee Code</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id}>
                        <td className="px-4">{index + 1}</td>
                        <td>
                          <span className="badge bg-secondary">{user.emp_id || '-'}</span>
                        </td>
                        <td>
                          <code className="bg-light px-2 py-1 rounded">{user.emp_code || '-'}</code>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                                 style={{ width: 40, height: 40 }}>
                              <i className="fas fa-user"></i>
                            </div>
                            <div>
                              <div className="fw-bold">{user.full_name_english || 'Unknown'}</div>
                              {user.full_name_bangla && (
                                <small className="text-muted">{user.full_name_bangla}</small>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{user.department || '-'}</td>
                        <td>{user.designation || '-'}</td>
                        <td>
                          <span className={`badge ${user.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                            {user.status || 'Active'}
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
      </div>
    </div>
  );
}
