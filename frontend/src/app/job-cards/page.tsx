'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { attendanceService, SearchParams } from '@/services/attendance.service';
import { JobCardEmployee } from '@/types/attendance';
import { SearchBar } from '@/components/dashboard/SearchBar';

export default function JobCardsPage() {
  const searchParams = useSearchParams();
  const [jobCards, setJobCards] = useState<JobCardEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [previewEmployee, setPreviewEmployee] = useState<JobCardEmployee | null>(null);

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
      const data = await attendanceService.getJobCards(currentParams);
      setJobCards(data);
      setSelectedEmployees(new Set());
      if (data.length > 0) {
        setPreviewEmployee(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load job cards:', err);
      setError(err.message || 'Failed to load job cards');
    } finally {
      setLoading(false);
    }
  }

  const toggleSelection = (acNo: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(acNo)) {
      newSet.delete(acNo);
    } else {
      newSet.add(acNo);
    }
    setSelectedEmployees(newSet);
  };

  const selectAll = () => {
    if (selectedEmployees.size === jobCards.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(jobCards.map(j => j.acNo)));
    }
  };

  const printSelected = () => {
    const selectedCards = jobCards.filter(j => selectedEmployees.has(j.acNo));
    if (selectedCards.length === 0) {
      alert('Please select at least one employee to print');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatePrintHTML(selectedCards));
      printWindow.document.close();
      printWindow.print();
    }
  };

  const printSingle = (employee: JobCardEmployee) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatePrintHTML([employee]));
      printWindow.document.close();
      printWindow.print();
    }
  };

  const generatePrintHTML = (employees: JobCardEmployee[]) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Cards - Attendance Report</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
          .job-card { page-break-after: always; border: 2px solid #333; padding: 20px; margin-bottom: 20px; }
          .job-card:last-child { page-break-after: auto; }
          .company-header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px; }
          .company-name { font-size: 18pt; font-weight: bold; margin: 0; }
          .report-title { font-size: 12pt; margin: 5px 0 0 0; }
          .employee-info { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border: 1px solid #ccc; }
          .info-item { display: flex; gap: 5px; }
          .info-label { font-weight: bold; }
          .summary-section { margin-bottom: 20px; }
          .section-title { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 15px; }
          .summary-box { border: 1px solid #333; padding: 8px; text-align: center; }
          .summary-label { font-size: 8pt; color: #555; margin-bottom: 3px; }
          .summary-value { font-size: 14pt; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          th, td { border: 1px solid #333; padding: 6px; text-align: center; }
          th { background: #e0e0e0; font-weight: bold; font-size: 8pt; }
          .status-present { background: #f0f0f0; }
          .status-absent { background: #ffcccc; }
          .status-late { background: #ffffcc; }
          .status-weekend { background: #e8e8e8; color: #666; }
          .text-left { text-align: left; }
          .font-mono { font-family: 'Courier New', monospace; }
        </style>
      </head>
      <body>
        ${employees.map(emp => `
          <div class="job-card">
            <div class="company-header">
              <h1 class="company-name">Skyview Online LTD</h1>
              <p class="report-title">INDIVIDUAL ATTENDANCE JOB CARD</p>
            </div>
            
            <div class="employee-info">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span>${emp.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">AC-No:</span>
                <span>${emp.acNo || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">No:</span>
                <span>${emp.no || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Emp No:</span>
                <span>${emp.empNo || 'N/A'}</span>
              </div>
            </div>

            <div class="summary-section">
              <div class="section-title">ATTENDANCE SUMMARY</div>
              <div class="summary-grid">
                <div class="summary-box">
                  <div class="summary-label">Total Days</div>
                  <div class="summary-value">${emp.summary.totalDays}</div>
                </div>
                <div class="summary-box">
                  <div class="summary-label">Working Days</div>
                  <div class="summary-value">${emp.summary.workingDays}</div>
                </div>
                <div class="summary-box">
                  <div class="summary-label">Present</div>
                  <div class="summary-value">${emp.summary.present}</div>
                </div>
                <div class="summary-box">
                  <div class="summary-label">Absent</div>
                  <div class="summary-value">${emp.summary.absent}</div>
                </div>
                <div class="summary-box">
                  <div class="summary-label">Late</div>
                  <div class="summary-value">${emp.summary.late}</div>
                </div>
                <div class="summary-box">
                  <div class="summary-label">Payable Days</div>
                  <div class="summary-value">${emp.summary.payableDays}</div>
                </div>
              </div>
            </div>

            <div class="section-title">DAILY ATTENDANCE RECORD</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>In Time</th>
                  <th>Out Time</th>
                  <th>Late</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${emp.records.map(r => {
                  let rowClass = '';
                  let displayStatus = r.status;
                  if (r.isFriday && !r.isPresent) {
                    rowClass = 'status-weekend';
                    displayStatus = 'Weekend';
                  } else if (r.status === 'Present') {
                    rowClass = 'status-present';
                  } else if (r.status === 'Absent') {
                    rowClass = 'status-absent';
                  } else if (r.status === 'Late') {
                    rowClass = 'status-late';
                  }
                  return `
                    <tr class="${rowClass}">
                      <td class="font-mono">${r.date}</td>
                      <td>${r.day}</td>
                      <td class="font-mono">${r.inTime || '-'}</td>
                      <td class="font-mono">${r.outTime || '-'}</td>
                      <td class="font-mono">${r.late || '-'}</td>
                      <td>${displayStatus}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h4 className="fw-bold mb-1">Employee Job Cards</h4>
          <p className="text-muted small mb-0">Individual attendance reports</p>
        </div>
        <div className="d-flex gap-2">
          <SearchBar params={currentParams} />
          <button onClick={selectAll} className="btn btn-outline-secondary btn-sm">
            <i className={`fas ${selectedEmployees.size === jobCards.length ? 'fa-check-square' : 'fa-square'} me-1`}></i>
            {selectedEmployees.size === jobCards.length ? 'Deselect All' : 'Select All'}
          </button>
          <button 
            onClick={printSelected} 
            className="btn btn-dark btn-sm"
            disabled={selectedEmployees.size === 0}
          >
            <i className="fas fa-print me-1"></i>
            Print Selected ({selectedEmployees.size})
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border spinner-border-sm me-2"></div>
          Loading job cards...
        </div>
      ) : jobCards.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="fas fa-file-alt fa-2x mb-3 opacity-25"></i>
          <p>No job cards found. Adjust search criteria.</p>
        </div>
      ) : (
        <div className="row">
          {/* Employee List */}
          <div className="col-md-4">
            <div className="card border">
              <div className="card-header bg-light py-2">
                <small className="fw-bold">Employees ({jobCards.length})</small>
              </div>
              <div className="list-group list-group-flush" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                {jobCards.map((emp, index) => (
                  <button
                    key={`${emp.acNo || 'na'}-${emp.empNo || 'na'}-${emp.no || 'na'}-${index}`}
                    onClick={() => setPreviewEmployee(emp)}
                    className={`list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 ${previewEmployee?.acNo === emp.acNo ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployees.has(emp.acNo)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(emp.acNo);
                      }}
                      className="form-check-input"
                    />
                    <div className="text-start flex-grow-1">
                      {/* Employee Name */}
                      <div className="fw-semibold small">{emp.name || 'N/A'}</div>
                      {/* All 4 Identity Fields: Emp No., AC-No., No., Name */}
                      <div className="text-muted smaller">
                        {emp.empNo && <span className="badge bg-info me-1" style={{fontSize: '0.7em'}}>Emp: {emp.empNo}</span>}
                        <span className="badge bg-primary me-1" style={{fontSize: '0.7em'}}>AC: {emp.acNo}</span>
                        {emp.no && <span className="badge bg-secondary me-1" style={{fontSize: '0.7em'}}>No: {emp.no}</span>}
                        <span className="text-success">Present: {emp.summary.present}</span>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right text-muted small"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="col-md-8">
            {previewEmployee ? (
              <JobCardPreview 
                employee={previewEmployee} 
                onPrint={() => printSingle(previewEmployee)}
              />
            ) : (
              <div className="card border h-100 d-flex align-items-center justify-content-center text-muted">
                <div className="text-center">
                  <i className="fas fa-hand-pointer fa-2x mb-2 opacity-25"></i>
                  <p>Select an employee to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCardPreview({ employee, onPrint }: { employee: JobCardEmployee; onPrint: () => void }) {
  const { summary, records } = employee;

  return (
    <div className="card border">
      {/* Preview Header */}
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
            <i className="fas fa-user small"></i>
          </div>
          <div>
            <h6 className="fw-bold mb-0">{employee.name || 'N/A'}</h6>
            <small className="text-muted">AC: {employee.acNo}</small>
          </div>
        </div>
        <button onClick={onPrint} className="btn btn-dark btn-sm">
          <i className="fas fa-print me-1"></i> Print This
        </button>
      </div>

      <div className="card-body">
        {/* Summary Stats */}
        <div className="row g-2 mb-4">
          <div className="col">
            <div className="border p-2 text-center">
              <small className="text-muted d-block">Working Days</small>
              <strong>{summary.workingDays}</strong>
            </div>
          </div>
          <div className="col">
            <div className="border p-2 text-center bg-light">
              <small className="text-muted d-block">Present</small>
              <strong className="text-success">{summary.present}</strong>
            </div>
          </div>
          <div className="col">
            <div className="border p-2 text-center bg-light">
              <small className="text-muted d-block">Absent</small>
              <strong className="text-danger">{summary.absent}</strong>
            </div>
          </div>
          <div className="col">
            <div className="border p-2 text-center bg-light">
              <small className="text-muted d-block">Late</small>
              <strong className="text-warning">{summary.late}</strong>
            </div>
          </div>
          <div className="col">
            <div className="border p-2 text-center">
              <small className="text-muted d-block">Payable</small>
              <strong>{summary.payableDays}</strong>
            </div>
          </div>
          <div className="col">
            <div className="border p-2 text-center">
              <small className="text-muted d-block">Weekends</small>
              <strong>{summary.weekend}</strong>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="table-responsive border" style={{maxHeight: '400px', overflowY: 'auto'}}>
          <table className="table table-sm table-bordered mb-0">
            <thead className="table-light sticky-top">
              <tr className="small">
                <th className="text-center">Date</th>
                <th className="text-center">Day</th>
                <th className="text-center">In</th>
                <th className="text-center">Out</th>
                <th className="text-center">Late</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody className="small">
              {records.map((r) => {
                const isWeekend = r.isFriday && !r.isPresent;
                return (
                  <tr key={r.date} className={isWeekend ? 'table-light' : ''}>
                    <td className="font-monospace text-center">{r.date}</td>
                    <td className="text-center">{r.day}</td>
                    <td className="font-monospace text-center">{r.inTime || '-'}</td>
                    <td className="font-monospace text-center">{r.outTime || '-'}</td>
                    <td className="font-monospace text-center text-warning">{r.late || '-'}</td>
                    <td className="text-center">
                      {isWeekend ? (
                        <span className="badge bg-secondary">Weekend</span>
                      ) : r.status === 'Present' ? (
                        <span className="badge bg-success">Present</span>
                      ) : r.status === 'Absent' ? (
                        <span className="badge bg-danger">Absent</span>
                      ) : (
                        <span className="badge bg-light text-dark">{r.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-muted small">
          <i className="fas fa-info-circle me-1"></i>
          Click "Print This" for a black & white professional report
        </div>
      </div>
    </div>
  );
}
