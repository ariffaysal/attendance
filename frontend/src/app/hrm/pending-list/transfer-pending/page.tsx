'use client';

export default function TransferPendingPage() {
  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <div>
          <h4 className="mb-1 fw-bold">Transfer Pending</h4>
          <p className="text-muted mb-0 small">HRM - Pending List / Transfer Pending</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <div className="mb-4">
            <i className="fas fa-exchange-alt fa-4x text-primary opacity-50"></i>
          </div>
          <h5 className="text-muted mb-3">Transfer Pending</h5>
          <p className="text-muted mb-0">
            This module is a placeholder. You can implement transfer pending list here.
          </p>
        </div>
      </div>
    </div>
  );
}
