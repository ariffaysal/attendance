'use client';

export default function PromotionPendingPage() {
  return (
    <div className="fade-in">
      <div className="top-bar mb-4">
        <div>
          <h4 className="mb-1 fw-bold">Promotion Pending</h4>
          <p className="text-muted mb-0 small">HRM - Pending List / Promotion Pending</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <div className="mb-4">
            <i className="fas fa-arrow-up fa-4x text-primary opacity-50"></i>
          </div>
          <h5 className="text-muted mb-3">Promotion Pending</h5>
          <p className="text-muted mb-0">
            This module is a placeholder. You can implement promotion pending list here.
          </p>
        </div>
      </div>
    </div>
  );
}
