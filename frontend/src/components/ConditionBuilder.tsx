'use client';

import { useState, useEffect } from 'react';
import { libraryService, RuleConditions, Condition, AvailableField, AvailableOperator } from '@/services/library.service';

interface ConditionBuilderProps {
  value: RuleConditions | null;
  onChange: (conditions: RuleConditions) => void;
  disabled?: boolean;
}

export default function ConditionBuilder({ value, onChange, disabled = false }: ConditionBuilderProps) {
  const [fields, setFields] = useState<AvailableField[]>([]);
  const [operators, setOperators] = useState<AvailableOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const conditions: RuleConditions = value || { logic: 'AND', conditions: [] };

  useEffect(() => {
    loadMetadata();
  }, []);

  async function loadMetadata() {
    try {
      const metadata = await libraryService.getRuleEngineMetadata();
      setFields(metadata.fields);
      setOperators(metadata.operators);
    } catch (err) {
      console.error('Failed to load rule engine metadata:', err);
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    const newCondition: Condition = {
      field: fields[0]?.field || '',
      operator: 'eq',
      value: '',
    };
    
    const updated = {
      ...conditions,
      conditions: [...conditions.conditions, newCondition],
    };
    
    onChange(updated);
    validateConditions(updated);
  }

  function removeCondition(index: number) {
    const updated = {
      ...conditions,
      conditions: conditions.conditions.filter((_, i) => i !== index),
    };
    
    onChange(updated);
    validateConditions(updated);
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    const updatedConditions = conditions.conditions.map((cond, i) =>
      i === index ? { ...cond, ...updates } : cond
    );
    
    const updated = { ...conditions, conditions: updatedConditions };
    onChange(updated);
    validateConditions(updated);
  }

  function updateLogic(logic: 'AND' | 'OR') {
    const updated = { ...conditions, logic };
    onChange(updated);
  }

  async function validateConditions(conds: RuleConditions) {
    if (conds.conditions.length === 0) {
      setValidationErrors([]);
      return;
    }

    try {
      const result = await libraryService.validateConditions(conds);
      setValidationErrors(result.errors);
    } catch (err) {
      // Silent fail - validation is optional
    }
  }

  function getOperatorLabel(operatorValue: string): string {
    return operators.find(op => op.operator === operatorValue)?.label || operatorValue;
  }

  function getFieldType(fieldName: string): string {
    return fields.find(f => f.field === fieldName)?.type || 'string';
  }

  function needsValue2(operator: string): boolean {
    return operator === 'between';
  }

  if (loading) {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2 text-muted small">Loading condition builder...</span>
      </div>
    );
  }

  return (
    <div className="condition-builder">
      {/* Logic Toggle */}
      {conditions.conditions.length > 1 && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="text-muted small">Match</span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${conditions.logic === 'AND' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => updateLogic('AND')}
              disabled={disabled}
            >
              ALL (AND)
            </button>
            <button
              type="button"
              className={`btn ${conditions.logic === 'OR' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => updateLogic('OR')}
              disabled={disabled}
            >
              ANY (OR)
            </button>
          </div>
          <span className="text-muted small">of the following conditions:</span>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="alert alert-warning alert-sm py-2 mb-3">
          <i className="fas fa-exclamation-triangle me-2"></i>
          <ul className="list-unstyled mb-0 small">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conditions List */}
      {conditions.conditions.length === 0 ? (
        <div className="text-center py-4 bg-light rounded">
          <p className="text-muted mb-2">
            <i className="fas fa-filter fa-2x opacity-50"></i>
          </p>
          <p className="text-muted small mb-0">No conditions defined</p>
          <p className="text-muted small">Click "Add Condition" to create one</p>
        </div>
      ) : (
        <div className="conditions-list">
          {conditions.conditions.map((condition, index) => (
            <div
              key={index}
              className="condition-row d-flex align-items-center gap-2 mb-2 p-2 bg-light rounded"
            >
              {/* Field Selector */}
              <select
                className="form-select form-select-sm w-field"
                value={condition.field}
                onChange={(e) => updateCondition(index, { field: e.target.value })}
                disabled={disabled}
                aria-label="Select field"
              >
                {fields.map((field) => (
                  <option key={field.field} value={field.field}>
                    {field.description}
                  </option>
                ))}
              </select>

              {/* Operator Selector */}
              <select
                className="form-select form-select-sm w-operator"
                value={condition.operator}
                onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                disabled={disabled}
                aria-label="Select operator"
              >
                {operators.map((op) => (
                  <option key={op.operator} value={op.operator}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value Input */}
              <input
                type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                className="form-control form-control-sm"
                placeholder="Value"
                value={condition.value}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                disabled={disabled}
              />

              {/* Second Value (for between operator) */}
              {needsValue2(condition.operator) && (
                <>
                  <span className="text-muted">and</span>
                  <input
                    type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                    className="form-control form-control-sm"
                    placeholder="Value 2"
                    value={condition.value2 || ''}
                    onChange={(e) => updateCondition(index, { value2: e.target.value })}
                    disabled={disabled}
                  />
                </>
              )}

              {/* Remove Button */}
              {!disabled && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => removeCondition(index)}
                  title="Remove condition"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Condition Button */}
      {!disabled && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary mt-2"
          onClick={addCondition}
        >
          <i className="fas fa-plus me-1"></i>
          Add Condition
        </button>
      )}
    </div>
  );
}
