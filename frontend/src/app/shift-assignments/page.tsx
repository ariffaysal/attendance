'use client';

import { useState, useEffect } from 'react';
import { shiftService, Shift, ShiftAssignment, RosterTemplate } from '@/services/shift.service';
import { employeePolicyTaggingService } from '@/services/employee-policy-tagging.service';

interface Employee {
  emp_code: string;
  emp_name: string;
  department?: string;
  designation?: string;
}

export default function ShiftAssignmentsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [calendarData, setCalendarData] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<number>(0);
  const [assignNotes, setAssignNotes] = useState('');
  
  // Bulk assignment
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkShiftId, setBulkShiftId] = useState<number>(0);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Generate roster
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateTemplateId, setGenerateTemplateId] = useState<number>(0);
  const [generateMonth, setGenerateMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedEmployee && selectedMonth) {
      loadCalendarData();
    }
  }, [selectedEmployee, selectedMonth]);

  async function loadInitialData() {
    try {
      const [shiftsData, templatesData, policyData] = await Promise.all([
        shiftService.getAllShifts(),
        shiftService.getRosterTemplates(),
        employeePolicyTaggingService.getAll()
      ]);
      
      setShifts(shiftsData);
      setTemplates(templatesData);
      
      // Extract unique employees from policy tagging
      const uniqueEmps = new Map<string, Employee>();
      policyData.forEach((p: any) => {
        if (!uniqueEmps.has(p.emp_code)) {
          uniqueEmps.set(p.emp_code, {
            emp_code: p.emp_code,
            emp_name: p.emp_name || p.emp_code,
            department: p.department,
            designation: p.designation
          });
        }
      });
      setEmployees(Array.from(uniqueEmps.values()));
    } catch (error) {
      console.error('Error loading initial data:', error);
      setMessage({ type: 'error', text: 'Failed to load initial data' });
    }
  }

  async function loadCalendarData() {
    if (!selectedEmployee || !selectedMonth) return;
    
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const fromDate = `${selectedMonth}-01`;
      const toDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;
      
      const data = await shiftService.getEmployeeShiftCalendar(selectedEmployee, fromDate, toDate);
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  }

  function getShiftForDate(date: string): ShiftAssignment | null {
    return calendarData.find(c => c.assignment_date === date) || null;
  }

  function getShiftColor(shiftCode?: string, isOffDay?: boolean): string {
    if (isOffDay) return '#e9ecef'; // Gray for off days
    
    const colors: Record<string, string> = {
      'MORNING': '#fff3cd', // Yellow
      'DAY': '#d1ecf1',     // Light blue
      'EVENING': '#f8d7da', // Light red/pink
      'NIGHT': '#d4edda',   // Light green
      'GENERAL': '#e2e3e5'  // Gray
    };
    return colors[shiftCode || ''] || '#ffffff';
  }

  function handleDateClick(date: string) {
    setSelectedDate(date);
    const existing = getShiftForDate(date);
    if (existing) {
      setSelectedShift(existing.shift_id || 0);
      setAssignNotes(existing.notes || '');
    } else {
      setSelectedShift(0);
      setAssignNotes('');
    }
    setShowAssignModal(true);
  }

  async function handleAssignShift() {
    if (!selectedEmployee || !selectedDate || !selectedShift) {
      setMessage({ type: 'error', text: 'Please select a shift' });
      return;
    }

    try {
      const result = await shiftService.assignShift({
        empCode: selectedEmployee,
        assignmentDate: selectedDate,
        shiftId: selectedShift,
        notes: assignNotes
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Shift assigned successfully' });
        setShowAssignModal(false);
        loadCalendarData();
        
        // Show validation warnings if any
        if (result.validation?.warnings?.length) {
          setTimeout(() => {
            setMessage({ 
              type: 'error', 
              text: `Warning: ${result.validation?.warnings?.join(', ')}` 
            });
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to assign shift' });
      }
    } catch (error) {
      console.error('Error assigning shift:', error);
      setMessage({ type: 'error', text: 'Failed to assign shift' });
    }
  }

  async function handleBulkAssign() {
    if (!selectedEmployee || !bulkStartDate || !bulkEndDate || !bulkShiftId) {
      setMessage({ type: 'error', text: 'Please fill all required fields' });
      return;
    }

    setLoading(true);
    try {
      const result = await shiftService.bulkAssignShifts({
        empCodes: selectedEmployees.length > 0 ? selectedEmployees : [selectedEmployee],
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        shiftId: bulkShiftId,
        skipWeekends
      });

      if (result.success) {
        setMessage({ type: 'success', text: `Assigned ${result.totalAssigned} shifts` });
        setShowBulkModal(false);
        loadCalendarData();
        
        if (result.warnings.length > 0) {
          setTimeout(() => {
            setMessage({ type: 'error', text: `${result.warnings.length} warnings. Check console for details.` });
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: `Failed: ${result.failed.length} assignments failed` });
      }
    } catch (error) {
      console.error('Error in bulk assign:', error);
      setMessage({ type: 'error', text: 'Bulk assignment failed' });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateRoster() {
    if (!generateTemplateId || !generateMonth) {
      setMessage({ type: 'error', text: 'Please select template and month' });
      return;
    }

    setLoading(true);
    try {
      const result = await shiftService.generateRoster({
        templateId: generateTemplateId,
        monthYear: generateMonth,
        empCodes: selectedEmployee ? [selectedEmployee] : 'ALL'
      });

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Generated ${result.totalAssignments} assignments. Violations: ${result.violationsFound}/${result.violationsResolved}` 
        });
        setShowGenerateModal(false);
        loadCalendarData();
      } else {
        setMessage({ type: 'error', text: `Failed: ${result.errors.join(', ')}` });
      }
    } catch (error) {
      console.error('Error generating roster:', error);
      setMessage({ type: 'error', text: 'Roster generation failed' });
    } finally {
      setLoading(false);
    }
  }

  function renderCalendar() {
    if (!selectedMonth) return null;
    
    const [year, month] = selectedMonth.split('-');
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days: JSX.Element[] = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const shift = getShiftForDate(dateStr);
      const isOffDay = shift?.is_off_day;
      const shiftCode = shift?.shift_code;
      const backgroundColor = getShiftColor(shiftCode, isOffDay);
      
      days.push(
        <div
          key={dateStr}
          className="calendar-day"
          style={{ 
            backgroundColor,
            cursor: 'pointer',
            border: selectedDate === dateStr ? '2px solid #007bff' : '1px solid #dee2e6'
          }}
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="day-number">{day}</div>
          {shift && (
            <div className="shift-info" style={{ fontSize: '10px', marginTop: '4px' }}>
              {isOffDay ? (
                <span className="badge bg-secondary">OFF</span>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold' }}>{shift.shift_name}</div>
                  <div style={{ color: '#666' }}>
                    {shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="calendar-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '4px',
        marginTop: '20px'
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="calendar-header" style={{ 
            textAlign: 'center', 
            fontWeight: 'bold',
            padding: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            {d}
          </div>
        ))}
        {days}
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <h2 className="mb-4">Shift & Duty Roster Management</h2>
      
      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage(null)} />
        </div>
      )}

      <div className="row mb-4">
        <div className="col-md-4">
          <label className="form-label">Select Employee</label>
          <select 
            className="form-select"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">-- Select Employee --</option>
            {employees.map(emp => (
              <option key={emp.emp_code} value={emp.emp_code}>
                {emp.emp_name} ({emp.emp_code}) - {emp.department}
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-md-3">
          <label className="form-label">Month</label>
          <input
            type="month"
            className="form-control"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        
        <div className="col-md-5 d-flex align-items-end gap-2">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAssignModal(true)}
            disabled={!selectedEmployee}
          >
            + Assign Shift
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowBulkModal(true)}
            disabled={!selectedEmployee}
          >
            Bulk Assign
          </button>
          <button 
            className="btn btn-info"
            onClick={() => setShowGenerateModal(true)}
            disabled={!selectedEmployee}
          >
            Generate Roster
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-3"><div className="spinner-border" /></div>}

      {selectedEmployee && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Shift Calendar - {employees.find(e => e.emp_code === selectedEmployee)?.emp_name}</span>
            <small className="text-muted">
              Click on a date to assign/edit shift | Colors: 
              <span style={{ backgroundColor: '#fff3cd', padding: '2px 6px' }}>Morning</span>{' '}
              <span style={{ backgroundColor: '#d1ecf1', padding: '2px 6px' }}>Day</span>{' '}
              <span style={{ backgroundColor: '#f8d7da', padding: '2px 6px' }}>Evening</span>{' '}
              <span style={{ backgroundColor: '#d4edda', padding: '2px 6px' }}>Night</span>
            </small>
          </div>
          <div className="card-body">
            {renderCalendar()}
          </div>
        </div>
      )}

      {/* Shift Legend */}
      <div className="mt-4">
        <h5>Available Shifts</h5>
        <div className="row">
          {shifts.map(shift => (
            <div key={shift.id} className="col-md-3 mb-2">
              <div className="card" style={{ backgroundColor: getShiftColor(shift.shift_code) }}>
                <div className="card-body py-2">
                  <strong>{shift.shift_name}</strong>
                  <div className="small text-muted">
                    {shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)}
                    {shift.grace_period_minutes > 0 && (
                      <span className="ms-2">(+{shift.grace_period_minutes}min grace)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showAssignModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Shift</h5>
                <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)} />
              </div>
              <div className="modal-body">
                {selectedDate && (
                  <p>Date: <strong>{selectedDate}</strong></p>
                )}
                
                <div className="mb-3">
                  <label className="form-label">Shift</label>
                  <select 
                    className="form-select"
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(Number(e.target.value))}
                  >
                    <option value={0}>-- Select Shift --</option>
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.shift_name} ({shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)})
                      </option>
                    ))}
                    <option value={-1}>Mark as OFF Day</option>
                  </select>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleAssignShift}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Bulk Shift Assignment</h5>
                <button type="button" className="btn-close" onClick={() => setShowBulkModal(false)} />
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Shift</label>
                  <select 
                    className="form-select"
                    value={bulkShiftId}
                    onChange={(e) => setBulkShiftId(Number(e.target.value))}
                  >
                    <option value={0}>-- Select Shift --</option>
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.shift_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="skipWeekends"
                    checked={skipWeekends}
                    onChange={(e) => setSkipWeekends(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="skipWeekends">
                    Skip Weekends
                  </label>
                </div>
                
                <div className="alert alert-info">
                  <strong>Target:</strong> {selectedEmployee} 
                  {selectedEmployees.length > 0 && ` + ${selectedEmployees.length} other employees`}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleBulkAssign} disabled={loading}>
                  {loading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Roster Modal */}
      {showGenerateModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Generate Roster from Template</h5>
                <button type="button" className="btn-close" onClick={() => setShowGenerateModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Template</label>
                  <select 
                    className="form-select"
                    value={generateTemplateId}
                    onChange={(e) => setGenerateTemplateId(Number(e.target.value))}
                  >
                    <option value={0}>-- Select Template --</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.templateName} ({template.cycleDays}-day cycle)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Month</label>
                  <input
                    type="month"
                    className="form-control"
                    value={generateMonth}
                    onChange={(e) => setGenerateMonth(e.target.value)}
                  />
                </div>
                
                {generateTemplateId > 0 && (
                  <div className="alert alert-info">
                    {(() => {
                      const template = templates.find(t => t.id === generateTemplateId);
                      return template ? (
                        <div>
                          <strong>Pattern:</strong>
                          <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            {template.pattern.map((p, i) => (
                              <span key={i} className={`badge ${p === 'OFF' ? 'bg-secondary' : 'bg-primary'} me-1`}>
                                Day {i + 1}: {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                
                <div className="alert alert-warning">
                  <strong>Note:</strong> This will auto-generate shifts for all days in the selected month. 
                  Existing assignments will be updated.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleGenerateRoster} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-day {
          min-height: 80px;
          padding: 8px;
          border-radius: 4px;
          transition: transform 0.1s;
        }
        .calendar-day:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .calendar-day.empty {
          background-color: transparent;
        }
        .day-number {
          font-weight: bold;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
