'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { employeeService, EmployeeSuggestion } from '@/services/employee.service';

interface EmployeeSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (employee: EmployeeSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  showSuggestions?: boolean;
  disabled?: boolean;
  label?: string;
  searchType?: 'name' | 'acc_no';
  onSearchTypeChange?: (searchType: 'name' | 'acc_no') => void;
}

export default function EmployeeSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Search by name or AC-No....',
  required = false,
  name,
  id,
  className = '',
  showSuggestions = true,
  disabled = false,
  label,
  searchType = 'name',
  onSearchTypeChange,
}: EmployeeSearchProps) {
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || !query.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const data = await employeeService.getSearchSuggestions(query, 10, searchType);
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [searchType]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowDropdown(true);
    setSelectedIndex(-1);

    // Debounce API call
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Only fetch if user typed at least 2 characters
    if (newValue && newValue.trim().length >= 2) {
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 300);
    } else {
      setSuggestions([]);
    }
  };

  // Handle employee selection
  const handleSelect = (employee: EmployeeSuggestion) => {
    // Use the appropriate field based on search type
    const displayValue = searchType === 'acc_no' 
      ? (employee.acNo || employee.emp_code || '')
      : (employee.name || employee.full_name_english || '');
    
    onChange(displayValue);
    setShowDropdown(false);
    if (onSelect) {
      onSelect(employee);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial load of suggestions when focused
  const handleFocus = () => {
    if (showSuggestions && !disabled) {
      setShowDropdown(true);
      // Only fetch if there's already a value with at least 2 chars
      if (value && value.trim().length >= 2) {
        fetchSuggestions(value);
      }
    }
  };

  return (
    <div className={`position-relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="form-label" htmlFor={id || name}>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}
      <div className="input-group">
        {onSearchTypeChange && (
          <select
            className="form-select"
            value={searchType}
            onChange={(e) => onSearchTypeChange(e.target.value as 'name' | 'acc_no')}
            title="Select search type"
            aria-label="Search type"
            style={{ maxWidth: '120px' }}
          >
            <option value="name">Name</option>
            <option value="acc_no">AC-No.</option>
          </select>
        )}
        <span className="input-group-text bg-light">
          <i className="fas fa-search text-muted"></i>
        </span>
        <input
          ref={inputRef}
          type="text"
          id={id || name}
          name={name}
          className="form-control"
          value={value || ''}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <span className="input-group-text bg-white">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </span>
        )}
        {!loading && value && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            title="Clear search"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary"
          title={showDropdown ? 'Hide suggestions' : 'Show suggestions'}
          onClick={() => {
            setShowDropdown(!showDropdown);
            if (!showDropdown) {
              fetchSuggestions(value);
            }
            inputRef.current?.focus();
          }}
          disabled={disabled}
        >
          <i className={`fas fa-chevron-${showDropdown ? 'up' : 'down'}`}></i>
        </button>
      </div>

      {/* Dropdown Suggestions */}
      {showDropdown && showSuggestions && (
        <div
          className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm z-3"
          style={{ maxHeight: '300px', overflowY: 'auto', zIndex: 1050 }}
        >
          {suggestions.length === 0 ? (
            <div className="p-3 text-muted text-center">
              <i className="fas fa-user-slash me-2"></i>
              No employees found
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {suggestions.map((employee, index) => (
                <button
                  key={employee.id}
                  type="button"
                  className={`list-group-item list-group-item-action p-2 ${
                    index === selectedIndex ? 'active' : ''
                  }`}
                  onClick={() => handleSelect(employee)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="d-flex align-items-center">
                    <div
                      className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${
                        index === selectedIndex ? 'bg-white text-primary' : 'bg-primary text-white'
                      }`}
                      style={{ width: 36, height: 36, fontSize: '14px' }}
                    >
                      <i className="fas fa-user"></i>
                    </div>
                    <div className="text-start flex-grow-1">
                      {/* Employee Name */}
                      <div className={`fw-semibold ${index === selectedIndex ? 'text-white' : 'text-dark'}`}>
                        {employee.name || employee.full_name_english || 'Unknown'}
                        {employee.full_name_bangla && (
                          <span className="ms-1 text-muted" style={{ fontSize: '0.85em' }}>
                            ({employee.full_name_bangla})
                          </span>
                        )}
                      </div>
                      {/* Show only Name and AC-No. columns as per system requirements */}
                      <div className={`small ${index === selectedIndex ? 'text-white-50' : 'text-muted'}`}>
                        {searchType === 'acc_no' ? (
                          <>
                            {employee.acNo && (
                              <span className="badge bg-primary me-2" title="AC-No.">AC: {employee.acNo}</span>
                            )}
                            {employee.name && (
                              <span>
                                <i className="fas fa-user me-1"></i>
                                {employee.name}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {employee.name && (
                              <span className="me-2">
                                <i className="fas fa-user me-1"></i>
                                {employee.name}
                              </span>
                            )}
                            {employee.acNo && (
                              <span className="badge bg-primary" title="AC-No.">AC: {employee.acNo}</span>
                            )}
                          </>
                        )}
                        {employee.department && (
                          <span className="ms-2">
                            <i className="fas fa-building me-1"></i>
                            {employee.department}
                          </span>
                        )}
                        {employee.designation && (
                          <span className="ms-2">
                            <i className="fas fa-briefcase me-1"></i>
                            {employee.designation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
