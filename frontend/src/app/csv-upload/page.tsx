'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { attendanceService } from '@/services/attendance.service';
import { Container, Card, Button, Alert, Spinner, Table, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faFileCsv, faCheckCircle, faExclamationTriangle, faArrowLeft, faCalendarAlt, faUsers, faDatabase } from '@fortawesome/free-solid-svg-icons';

export default function CsvUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    recordsProcessed: number;
    logsInserted: number;
    punchesCreated: number;
    dateRange: { from: string; to: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(csv|xls|xlsx)$/i)) {
        setError('Please select a CSV or Excel file');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const result = await attendanceService.uploadCsv(selectedFile);
      setUploadResult(result);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to upload CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.match(/\.(csv|xls|xlsx)$/i)) {
        setError('Please drop a CSV or Excel file');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  return (
    <Container className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <FontAwesomeIcon icon={faFileCsv} className="me-2 text-success" />
            Upload Attendance CSV
          </h2>
          <p className="text-muted mb-0">
            Import monthly attendance data from CSV or Excel files
          </p>
        </div>
        <Button variant="outline-secondary" onClick={() => router.push('/')}>
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Upload Area */}
      <Card className="mb-4">
        <Card.Body className="p-5">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="text-center"
            style={{
              border: '2px dashed #dee2e6',
              borderRadius: '8px',
              padding: '40px 20px',
              backgroundColor: selectedFile ? '#f8fff8' : '#fafafa',
              borderColor: selectedFile ? '#28a745' : '#dee2e6',
            }}
          >
            <FontAwesomeIcon 
              icon={faUpload} 
              size="3x" 
              className={selectedFile ? 'text-success' : 'text-muted'} 
              style={{ marginBottom: '20px' }}
            />
            
            {selectedFile ? (
              <div>
                <h5 className="text-success mb-2">
                  <FontAwesomeIcon icon={faFileCsv} className="me-2" />
                  {selectedFile.name}
                </h5>
                <p className="text-muted mb-3">
                  File size: {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="me-2"
                >
                  Change File
                </Button>
                <Button 
                  variant="success" 
                  size="sm" 
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} className="me-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <h5 className="text-muted mb-2">Drag & drop your CSV or Excel file here</h5>
                <p className="text-muted mb-3">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <Button
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FontAwesomeIcon icon={faFileCsv} className="me-2" />
                  Select File
                </Button>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {/* Success Result */}
      {uploadResult && (
        <Card className="mb-4 border-success">
          <Card.Header className="bg-success text-white">
            <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
            Upload Successful!
          </Card.Header>
          <Card.Body>
            <p className="mb-4">{uploadResult.message}</p>
            
            <Table bordered responsive>
              <tbody>
                <tr>
                  <td className="bg-light" style={{ width: '40%' }}>
                    <FontAwesomeIcon icon={faDatabase} className="me-2 text-primary" />
                    Records Processed
                  </td>
                  <td>
                    <Badge bg="primary" className="fs-6">
                      {uploadResult.recordsProcessed.toLocaleString()}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td className="bg-light">
                    <FontAwesomeIcon icon={faFileCsv} className="me-2 text-success" />
                    Logs Inserted
                  </td>
                  <td>
                    <Badge bg="success" className="fs-6">
                      {uploadResult.logsInserted.toLocaleString()}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td className="bg-light">
                    <FontAwesomeIcon icon={faUsers} className="me-2 text-info" />
                    Punch Entries Created
                  </td>
                  <td>
                    <Badge bg="info" className="fs-6">
                      {uploadResult.punchesCreated.toLocaleString()}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td className="bg-light">
                    <FontAwesomeIcon icon={faCalendarAlt} className="me-2 text-warning" />
                    Date Range
                  </td>
                  <td>
                    <Badge bg="warning" text="dark" className="fs-6">
                      {uploadResult.dateRange.from} to {uploadResult.dateRange.to}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </Table>

            <div className="d-flex gap-2">
              <Button 
                variant="primary" 
                onClick={() => router.push('/job-cards')}
              >
                View Job Cards
              </Button>
              <Button 
                variant="outline-primary" 
                onClick={() => router.push('/monthly')}
              >
                View Monthly Report
              </Button>
              <Button 
                variant="outline-success" 
                onClick={() => router.push('/')}
              >
                Go to Dashboard
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* CSV Format Info */}
      <Card className="mt-4">
        <Card.Header className="bg-light">
          <h5 className="mb-0">Required CSV Format</h5>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-3">
            Your CSV file <strong>must have exactly these columns</strong> in the header row:
          </p>
          <div className="bg-light p-3 rounded mb-3" style={{ fontFamily: 'monospace', fontSize: '0.85rem', overflowX: 'auto' }}>
            Status, Emp No., AC-No., No., Name, Auto-Assign, Date, Timetable, On duty, Off duty, Clock In, Clock Out, Normal, Real time, Late, Early, Absent, OT Time, Work Time, Exception, Must C/In, Must C/Out, Department, NDays, WeekEnd, Holiday, ATT_Time, NDays_OT, WeekEnd_OT, Holiday_OT
          </div>
          <div className="table-responsive">
            <Table size="sm" bordered className="mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '20%' }}>Column</th>
                  <th style={{ width: '25%' }}>Description</th>
                  <th style={{ width: '20%' }}>Example</th>
                  <th style={{ width: '35%' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-success"><td><strong>Status</strong></td><td>Attendance Status</td><td>Present / Absent</td><td>Required</td></tr>
                <tr className="table-success"><td><strong>Emp No.</strong></td><td>Employee Number</td><td>2</td><td>Required</td></tr>
                <tr className="table-success"><td><strong>AC-No.</strong></td><td>Access Control No</td><td>2</td><td>Required</td></tr>
                <tr className="table-success"><td><strong>No.</strong></td><td>Employee Code</td><td>E0015</td><td>Required</td></tr>
                <tr className="table-success"><td><strong>Name</strong></td><td>Employee Name</td><td>Md. Abu Sayeam</td><td>Required</td></tr>
                <tr><td>Auto-Assign</td><td>Auto assignment flag</td><td>True / empty</td><td>Optional</td></tr>
                <tr className="table-success"><td><strong>Date</strong></td><td>Attendance Date</td><td>1/1/2026</td><td>Format: M/D/YYYY</td></tr>
                <tr><td>Timetable</td><td>Shift type</td><td>Daytime</td><td>Optional</td></tr>
                <tr><td>On duty</td><td>Scheduled start</td><td>10:00</td><td>Optional</td></tr>
                <tr><td>Off duty</td><td>Scheduled end</td><td>18:00</td><td>Optional</td></tr>
                <tr className="table-success"><td><strong>Clock In</strong></td><td>Actual check-in</td><td>10:04</td><td>Required</td></tr>
                <tr className="table-success"><td><strong>Clock Out</strong></td><td>Actual check-out</td><td>18:58</td><td>Required</td></tr>
                <tr><td>Normal</td><td>Normal hours</td><td>1</td><td>Optional</td></tr>
                <tr><td>Real time</td><td>Real hours</td><td>1</td><td>Optional</td></tr>
                <tr><td>Late</td><td>Late duration</td><td>01:00</td><td>Optional</td></tr>
                <tr><td>Early</td><td>Early departure</td><td></td><td>Optional</td></tr>
                <tr><td>Absent</td><td>Absent flag</td><td>True</td><td>Optional</td></tr>
                <tr><td>OT Time</td><td>Overtime</td><td>06:55</td><td>Optional</td></tr>
                <tr><td>Work Time</td><td>Total work time</td><td>07:55</td><td>Optional</td></tr>
                <tr><td>Exception</td><td>Exceptions</td><td></td><td>Optional</td></tr>
                <tr><td>Must C/In</td><td>Must clock in</td><td>True</td><td>Optional</td></tr>
                <tr><td>Must C/Out</td><td>Must clock out</td><td>True</td><td>Optional</td></tr>
                <tr className="table-success"><td><strong>Department</strong></td><td>Department</td><td>OUR COMPANY</td><td>Required</td></tr>
                <tr><td>NDays</td><td>Normal days</td><td>1</td><td>Optional</td></tr>
                <tr><td>WeekEnd</td><td>Weekend days</td><td></td><td>Optional</td></tr>
                <tr><td>Holiday</td><td>Holiday days</td><td></td><td>Optional</td></tr>
                <tr><td>ATT_Time</td><td>Attendance time</td><td>07:55</td><td>Optional</td></tr>
                <tr><td>NDays_OT</td><td>Normal day OT</td><td></td><td>Optional</td></tr>
                <tr><td>WeekEnd_OT</td><td>Weekend OT</td><td></td><td>Optional</td></tr>
                <tr><td>Holiday_OT</td><td>Holiday OT</td><td></td><td>Optional</td></tr>
              </tbody>
            </Table>
          </div>
          <Alert variant="warning" className="mt-3 mb-0">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <strong>Important:</strong> The CSV file must have a header row with exactly these column names. 
            If your file has different column names or is missing required columns, the upload will fail with an error message showing which columns are missing.
          </Alert>
        </Card.Body>
      </Card>
    </Container>
  );
}
