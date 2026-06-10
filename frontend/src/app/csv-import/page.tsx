'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { attendanceService } from '@/services/attendance.service';
import { Container, Card, Button, Alert, Spinner, Table, Badge, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUpload,
  faFileCsv,
  faCheckCircle,
  faExclamationTriangle,
  faArrowLeft,
  faCalendarAlt,
  faUsers,
  faDatabase
} from '@fortawesome/free-solid-svg-icons';

export default function CsvImportPage() {
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
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseCSVPreview = (text: string) => {
    const lines = text.split('\n').filter((line: string) => line.trim());
    if (lines.length === 0) return;

    const headers = lines[0].split(',').map((h: string) => h.trim());
    setPreviewHeaders(headers);

    const rows = lines.slice(1, 6).map((line: string) => {
      const values = line.split(',').map((v: string) => v.trim());
      return values;
    });
    setPreviewRows(rows);
    setTotalRows(lines.length - 1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.csv', '.xls', '.xlsx'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!hasValidExtension) {
        setError('Please select a CSV or Excel file (.csv, .xls, .xlsx)');
        clearFile();
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSVPreview(text);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    if (file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSVPreview(text);
      };
      reader.readAsText(file);
    } else {
      setError('Please drop a CSV or Excel file (.csv, .xls, .xlsx)');
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
      clearFile();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  const requiredColumns = [
    'Emp No.', 'AC-No.', 'No.', 'Name', 'Date', 'Clock In', 'Clock Out', 'Department'
  ];

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">CSV Import</h4>
        <Button variant="outline-secondary" size="sm" onClick={() => router.push('/')}>
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Back
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Header className="bg-light">
          <h6 className="mb-0">Upload CSV File</h6>
        </Card.Header>
        <Card.Body>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border border-dashed rounded p-4 text-center mb-3"
            style={{
              borderWidth: '2px',
              borderStyle: 'dashed',
              backgroundColor: selectedFile ? '#f8fff8' : '#fafafa',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.xls,.xlsx"
              className="d-none"
              title="Select CSV file"
            />
            <FontAwesomeIcon icon={faFileCsv} size="2x" className="text-muted mb-2" />
            <p className="mb-1 small">Click to select or drag and drop CSV/Excel file</p>
            <p className="text-muted small mb-0">Max file size: 10MB</p>
          </div>

          {previewHeaders.length > 0 && (
            <Card className="mb-3">
              <Card.Header className="bg-light">
                <small className="mb-0">Preview ({previewRows.length} of {totalRows} rows)</small>
              </Card.Header>
              <Card.Body className="p-0">
                <div style={{ maxHeight: '250px', overflow: 'auto' }}>
                  <Table size="sm" bordered className="mb-0">
                    <thead className="table-light">
                      <tr>
                        {previewHeaders.map((header, idx) => (
                          <th key={idx} className="small">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {previewHeaders.map((_, colIdx) => (
                            <td key={colIdx} className="small">{row[colIdx] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}

          {selectedFile && (
            <Alert variant="info" className="mb-3 py-2">
              <small>Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</small>
            </Alert>
          )}

          {error && (
            <Alert variant="danger" className="mb-3 py-2">
              <small>{error}</small>
            </Alert>
          )}

          <div className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex-grow-1"
            >
              {isUploading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUpload} className="me-2" />
                  Process File
                </>
              )}
            </Button>
            {selectedFile && (
              <Button variant="outline-secondary" onClick={clearFile}>
                Clear
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header className="bg-light">
          <h6 className="mb-0">Required File Format</h6>
        </Card.Header>
        <Card.Body>
          <p className="small text-muted mb-2">CSV or Excel file must contain the following columns:</p>
          <div className="d-flex flex-wrap gap-1 mb-3">
            {requiredColumns.map((col) => (
              <Badge bg="light" text="dark" className="border" key={col}>
                <small>{col}</small>
              </Badge>
            ))}
          </div>
          <Alert variant="warning" className="mb-0 py-2">
            <small><FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
            Status is auto-generated from Clock In values.</small>
          </Alert>
        </Card.Body>
      </Card>

      {uploadResult && (
        <Card className="border-success">
          <Card.Header className="bg-success text-white">
            <h6 className="mb-0">
              <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
              Import Complete
            </h6>
          </Card.Header>
          <Card.Body>
            <Row className="text-center g-2 mb-3">
              <Col xs={4}>
                <div className="p-2 bg-light rounded">
                  <h5 className="mb-0">{uploadResult.recordsProcessed}</h5>
                  <small className="text-muted">Records</small>
                </div>
              </Col>
              <Col xs={4}>
                <div className="p-2 bg-light rounded">
                  <h5 className="mb-0">{uploadResult.logsInserted}</h5>
                  <small className="text-muted">Logs</small>
                </div>
              </Col>
              <Col xs={4}>
                <div className="p-2 bg-light rounded">
                  <h5 className="mb-0">{uploadResult.punchesCreated}</h5>
                  <small className="text-muted">Punches</small>
                </div>
              </Col>
            </Row>
            <div className="d-flex gap-2 justify-content-center">
              <Button variant="primary" size="sm" onClick={() => router.push('/')}>
                <FontAwesomeIcon icon={faDatabase} className="me-1" />
                Dashboard
              </Button>
              <Button variant="outline-primary" size="sm" onClick={() => router.push('/job-card')}>
                <FontAwesomeIcon icon={faUsers} className="me-1" />
                Job Cards
              </Button>
              <Button variant="outline-primary" size="sm" onClick={() => router.push('/monthly-report')}>
                <FontAwesomeIcon icon={faCalendarAlt} className="me-1" />
                Report
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
