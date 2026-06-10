'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeeSalaryInformationService } from '@/services/employee-salary-information.service';
import { employeeService, EmployeeSuggestion } from '@/services/employee.service';
import { BankInfo, SalaryBreakdown } from '@/types/employee-salary-information';
import EmployeeSearch from '@/components/EmployeeSearch';

export default function NewEmployeeSalaryInformationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSuggestion | null>(null);
  const [validatingEmployee, setValidatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'name' | 'acc_no'>('name');

  const [empCode, setEmpCode] = useState('');
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empNo, setEmpNo] = useState('');    // Emp No. field
  const [acNo, setAcNo] = useState('');      // AC-No. field  
  const [no, setNo] = useState('');          // No. field
  const [category, setCategory] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [division, setDivision] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [subsection, setSubsection] = useState('');
  const [designation, setDesignation] = useState('');

  const [sGrade, setSGrade] = useState('');
  const [stSalary, setStSalary] = useState('');
  const [grossSalary, setGrossSalary] = useState('');
  const [bGross, setBGross] = useState('');
  const [cashDisbursement, setCashDisbursement] = useState('No');
  const [policy, setPolicy] = useState('');
  const [mode, setMode] = useState('Actual');

  // Optional Salary Additions
  const [attendanceBonus, setAttendanceBonus] = useState({ enabled: false, amount: '' });
  const [incentive, setIncentive] = useState({ enabled: false, amount: '' });
  const [otherAdditions, setOtherAdditions] = useState<{id: number, label: string, amount: string}[]>([]);

  // Optional Deductions
  const [providentFund, setProvidentFund] = useState({ enabled: false, amount: '' });
  const [advance, setAdvance] = useState({ enabled: false, amount: '' });
  const [stamp, setStamp] = useState({ enabled: false, amount: '' });
  const [transportDeduction, setTransportDeduction] = useState({ enabled: false, amount: '' });
  const [lunchContribution, setLunchContribution] = useState({ enabled: false, amount: '' });
  const [ait, setAit] = useState({ enabled: false, amount: '' });
  const [punishmentAmount, setPunishmentAmount] = useState({ enabled: false, amount: '' });
  const [otherDeductions, setOtherDeductions] = useState<{id: number, label: string, amount: string}[]>([]);

  const [bankInfos, setBankInfos] = useState<BankInfo[]>([
    {
      id: 1,
      salaryBank: '',
      branchName: '',
      accountNo: '',
      salaryAmount: '',
      salaryPeriod: '',
      showTax: 'Yes',
      sequence: '1',
    },
  ]);

  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdown[]>([]);
  const [basicMode, setBasicMode] = useState<'formula' | 'percentage'>('percentage');

  // Dropdown selection states for quick add
  const [selectedAddition, setSelectedAddition] = useState('');
  const [selectedDeduction, setSelectedDeduction] = useState('');
  const [additionAmount, setAdditionAmount] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [customAdditionLabel, setCustomAdditionLabel] = useState('');
  const [customDeductionLabel, setCustomDeductionLabel] = useState('');

  const handleBankInfoChange = (id: number, field: keyof BankInfo, value: string) => {
    setBankInfos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addBankInfoRow = () => {
    const newId = bankInfos.length > 0 ? Math.max(...bankInfos.map((b) => b.id || 0)) + 1 : 1;
    const newSequence = (bankInfos.length + 1).toString();
    setBankInfos((prev) => [
      ...prev,
      {
        id: newId,
        salaryBank: '',
        branchName: '',
        accountNo: '',
        salaryAmount: '',
        salaryPeriod: '',
        showTax: 'Yes',
        sequence: newSequence,
      },
    ]);
  };

  const removeBankInfoRow = (id: number) => {
    if (bankInfos.length > 1) {
      setBankInfos((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Salary Breakdown Functions
  const handleBreakdownChange = (id: number, field: keyof SalaryBreakdown, value: string) => {
    setSalaryBreakdown((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          
          // Auto-set percentage when Payroll Head changes
          if (field === 'payrollHead' && updated.type === 'Percentage') {
            const headPercentages: Record<string, string> = {
              'Basic': '50',
              'House Rent': '30',
              'Medical Allowance': '15',
              'Conveyance': '5',
              'Stamp': '0',
            };
            if (headPercentages[value]) {
              updated.percentageFormula = headPercentages[value];
            }
          }
          
          return updated;
        }
        return item;
      })
    );
  };

  const addBreakdownRow = () => {
    const newId = salaryBreakdown.length > 0 ? Math.max(...salaryBreakdown.map((b) => b.id || 0)) + 1 : 1;
    const newSequence = (salaryBreakdown.length + 1).toString();
    setSalaryBreakdown((prev) => [
      ...prev,
      {
        id: newId,
        payrollHead: '',
        type: 'Percentage',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: '',
        sequence: newSequence,
      },
    ]);
  };

  const removeBreakdownRow = (id: number) => {
    const rowToRemove = salaryBreakdown.find(item => item.id === id);
    if (rowToRemove) {
      // Check if it's an other addition
      const isOtherAddition = otherAdditions.some(a => a.label === rowToRemove.payrollHead);
      if (isOtherAddition) {
        setOtherAdditions(prev => prev.filter(a => a.label !== rowToRemove.payrollHead));
      }
      // Check if it's an other deduction
      const isOtherDeduction = otherDeductions.some(d => d.label === rowToRemove.payrollHead);
      if (isOtherDeduction) {
        setOtherDeductions(prev => prev.filter(d => d.label !== rowToRemove.payrollHead));
      }
    }
    setSalaryBreakdown((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick add functions for additions and deductions
  const quickAddRow = (payrollHead: string, amount: string, isDeduction: boolean = false) => {
    const finalAmount = isDeduction ? (-parseFloat(amount || '0')).toFixed(2) : parseFloat(amount || '0').toFixed(2);
    
    console.log('quickAddRow called:', { payrollHead, amount, finalAmount, isDeduction });
    
    setSalaryBreakdown((prev) => {
      const newId = prev.length > 0 ? Math.max(...prev.map((b) => b.id || 0)) + 1 : 1;
      const newSequence = (prev.length + 1).toString();
      
      console.log('Adding row to salaryBreakdown:', { newId, payrollHead, finalAmount, prevLength: prev.length });
      
      return [
        ...prev,
        {
          id: newId,
          payrollHead,
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: finalAmount,
          sequence: newSequence,
        },
      ];
    });
  };

  const quickAddAddition = (type: 'attendance' | 'incentive' | 'other') => {
    if (type === 'attendance' && attendanceBonus.amount) {
      quickAddRow('Attendance Bonus', attendanceBonus.amount, false);
      setAttendanceBonus({ enabled: true, amount: attendanceBonus.amount });
    } else if (type === 'incentive' && incentive.amount) {
      quickAddRow('Incentive', incentive.amount, false);
      setIncentive({ enabled: true, amount: incentive.amount });
    } else if (type === 'other') {
      // Add all other additions from the array
      otherAdditions.forEach((addition) => {
        if (addition.amount && addition.label) {
          quickAddRow(addition.label, addition.amount, false);
        }
      });
    }
  };

  const quickAddDeduction = (type: 'pf' | 'advance' | 'stamp' | 'transport' | 'lunch' | 'ait' | 'punishment' | 'other') => {
    const deductionMap: Record<string, { label: string; amount: string }> = {
      pf: { label: 'Provident Fund', amount: providentFund.amount },
      advance: { label: 'Advance', amount: advance.amount },
      stamp: { label: 'Stamp', amount: stamp.amount },
      transport: { label: 'Transport Deduction', amount: transportDeduction.amount },
      lunch: { label: 'Lunch Contribution', amount: lunchContribution.amount },
      ait: { label: 'AIT', amount: ait.amount },
      punishment: { label: 'Punishment Amount', amount: punishmentAmount.amount },
    };
    
    if (type === 'other') {
      // Add all other deductions from the array
      otherDeductions.forEach((deduction) => {
        if (deduction.amount && deduction.label) {
          quickAddRow(deduction.label, deduction.amount, true);
        }
      });
    } else if (deductionMap[type] && deductionMap[type].amount) {
      quickAddRow(deductionMap[type].label, deductionMap[type].amount, true);
    }
  };

  // Add from dropdown selection
  const addFromDropdown = (type: 'addition' | 'deduction') => {
    console.log('addFromDropdown called:', { type, selectedAddition, additionAmount, selectedDeduction, deductionAmount });
    
    if (type === 'addition' && selectedAddition && additionAmount) {
      const label = selectedAddition === 'Other' ? customAdditionLabel : selectedAddition;
      if (selectedAddition === 'Other' && !label) return;
      
      console.log('Adding addition:', { label, amount: additionAmount });
      
      // ALWAYS add to otherAdditions array so it's saved properly
      setOtherAdditions(prev => {
        const newAddition = {
          id: prev.length + 1,
          label: label,
          amount: additionAmount
        };
        console.log('Adding to otherAdditions:', newAddition);
        return [...prev, newAddition];
      });
      
      quickAddRow(label, additionAmount, false);
      
      // Reset fields
      setSelectedAddition('');
      setAdditionAmount('');
      setCustomAdditionLabel('');
    } else if (type === 'deduction' && selectedDeduction && deductionAmount) {
      const label = selectedDeduction === 'Other' ? customDeductionLabel : selectedDeduction;
      if (selectedDeduction === 'Other' && !label) return;
      
      // ALWAYS add to otherDeductions array so it's saved properly
      setOtherDeductions(prev => [...prev, {
        id: prev.length + 1,
        label: label,
        amount: deductionAmount
      }]);
      
      quickAddRow(label, deductionAmount, true);
      // Reset fields
      setSelectedDeduction('');
      setDeductionAmount('');
      setCustomDeductionLabel('');
    }
  };

  const recalculateWithFixed = useCallback((gross: number, currentBreakdown: SalaryBreakdown[]) => {
    console.log('recalculateWithFixed called with gross:', gross, 'breakdown:', currentBreakdown);
    
    // Default percentages for each Payroll Head
    const defaultPercentages: Record<string, number> = {
      'Basic': 50,
      'House Rent': 30,
      'Medical Allowance': 15,
      'Conveyance': 5,
      'Stamp': 0,
    };
    
    // Check if Basic uses Formula type
    const basicRow = currentBreakdown.find(row => row.payrollHead === 'Basic');
    const isBasicFormula = basicRow && basicRow.type === 'Formula';
    
    // Step 1: Calculate Medical Allowance and Conveyance first (they are inputs to Basic formula)
    let medicalAmount = 0;
    let conveyanceAmount = 0;
    
    const firstPassBreakdown = currentBreakdown.map((row) => {
      if (row.payrollHead === 'Basic' || row.payrollHead === 'House Rent' || row.payrollHead === 'Stamp') {
        // Skip for now - will calculate after Basic is determined
        return { ...row, amount: '' };
      }
      
      if (row.payrollHead === 'Medical Allowance' || row.payrollHead === 'Conveyance') {
        let amount = 0;
        if (row.type === 'Fixed') {
          amount = parseFloat(row.amount) || 0;
        } else {
          // Percentage of Gross
          const pct = parseFloat(row.percentageFormula) || defaultPercentages[row.payrollHead] || 0;
          amount = gross * (pct / 100);
        }
        
        if (row.payrollHead === 'Medical Allowance') medicalAmount = amount;
        if (row.payrollHead === 'Conveyance') conveyanceAmount = amount;
        
        return {
          ...row,
          amount: amount.toFixed(2),
          percentageFormula: row.type === 'Fixed' ? row.percentageFormula : (parseFloat(row.percentageFormula) || defaultPercentages[row.payrollHead] || 0).toString(),
        };
      }
      
      return { ...row };
    });
    
    console.log('Step 1 - Medical Allowance:', medicalAmount, 'Conveyance:', conveyanceAmount);

    // Step 2: Calculate Basic
    let basicAmount = 0;
    let remainingAfterBasic = 0;
    
    if (basicRow) {
      if (basicRow.type === 'Formula') {
        // Formula: Basic = (Gross - Medical Allowance - Conveyance) / 1.35
        basicAmount = (gross - medicalAmount - conveyanceAmount) / 1.35;
        console.log('Formula Basic:', basicAmount);
      } else if (basicRow.type === 'Fixed') {
        basicAmount = parseFloat(basicRow.amount) || 0;
      } else {
        // Percentage of Gross
        const pct = parseFloat(basicRow.percentageFormula) || defaultPercentages['Basic'] || 0;
        basicAmount = gross * (pct / 100);
      }
      
      remainingAfterBasic = gross - medicalAmount - conveyanceAmount - basicAmount;
      console.log('Remaining after Basic:', remainingAfterBasic);
      
      // Update Basic row
      const basicIndex = firstPassBreakdown.findIndex(row => row.payrollHead === 'Basic');
      if (basicIndex >= 0) {
        firstPassBreakdown[basicIndex] = {
          ...firstPassBreakdown[basicIndex],
          amount: basicAmount.toFixed(2),
          percentageFormula: basicRow.type === 'Formula' ? 'Formula' : (parseFloat(basicRow.percentageFormula) || defaultPercentages['Basic'] || 0).toString(),
        };
      }
    }

    // Step 3: When Basic is Formula, House Rent = Basic / 2
    const finalBreakdown = firstPassBreakdown.map((row) => {
      if (row.payrollHead === 'House Rent') {
        if (row.type === 'Fixed') {
          return { ...row, amount: (parseFloat(row.amount) || 0).toFixed(2) };
        } else if (isBasicFormula) {
          // When Basic is Formula, House Rent = Basic / 2
          const amount = basicAmount / 2;
          return {
            ...row,
            amount: amount.toFixed(2),
            percentageFormula: 'Basic/2',
          };
        } else {
          // Normal percentage of Gross
          const pct = parseFloat(row.percentageFormula) || defaultPercentages['House Rent'] || 0;
          const amount = gross * (pct / 100);
          return {
            ...row,
            amount: amount.toFixed(2),
            percentageFormula: pct.toString(),
          };
        }
      } else if (row.payrollHead === 'Stamp') {
        if (row.type === 'Fixed') {
          return { ...row, amount: (parseFloat(row.amount) || 0).toFixed(2) };
        } else if (isBasicFormula) {
          // Stamp is 0 when Basic is Formula
          return {
            ...row,
            amount: '0.00',
            percentageFormula: '0',
          };
        } else {
          // Normal percentage of Gross
          const pct = parseFloat(row.percentageFormula) || defaultPercentages['Stamp'] || 0;
          const amount = gross * (pct / 100);
          return {
            ...row,
            amount: amount.toFixed(2),
            percentageFormula: pct.toString(),
          };
        }
      }
      return row;
    });

    console.log('Final breakdown:', finalBreakdown);
    setSalaryBreakdown(finalBreakdown);
  }, [setSalaryBreakdown]);

  const calculateSalaryStructure = useCallback(() => {
    const gross = parseFloat(grossSalary);
    console.log('Calculate clicked, gross salary:', gross);
    if (isNaN(gross) || gross <= 0) {
      alert('Please enter a valid Gross Salary');
      return;
    }

    // If no existing breakdown, create default structure
    if (salaryBreakdown.length === 0) {
      console.log('Creating new breakdown...');
      const targetStructure = [
        { head: 'Basic', pct: 50 },
        { head: 'House Rent', pct: 30 },
        { head: 'Medical Allowance', pct: 15 },
        { head: 'Conveyance', pct: 5 },
      ];

      const newBreakdown: SalaryBreakdown[] = targetStructure.map((item, index) => ({
        id: index + 1,
        payrollHead: item.head,
        type: 'Percentage',
        percentageFormula: item.pct.toString(),
        baseHead: 'Gross Salary',
        amount: (gross * (item.pct / 100)).toFixed(2),
        sequence: (index + 1).toString(),
      }));

      setSalaryBreakdown(newBreakdown);
    } else {
      console.log('Recalculating with fixed amounts...', salaryBreakdown);
      // Recalculate with Fixed amounts preserved
      recalculateWithFixed(gross, salaryBreakdown);
    }
  }, [grossSalary, salaryBreakdown, recalculateWithFixed]);

  const getTotalAmount = () => {
    return salaryBreakdown
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
      .toFixed(2);
  };

  const getTotalWithAdditions = () => {
    const base = parseFloat(grossSalary || '0');
    // Calculate additions from salaryBreakdown table rows
    const basicComponents = ['Basic', 'House Rent', 'Medical Allowance', 'Conveyance', 'Stamp'];
    const additionsFromTable = salaryBreakdown.reduce((sum, row) => {
      const amount = parseFloat(row.amount || '0');
      const payrollHead = (row.payrollHead || '').trim();
      // Additions are positive amounts that are not basic salary components
      if (amount > 0 && !basicComponents.includes(payrollHead)) {
        return sum + amount;
      }
      return sum;
    }, 0);
    return (base + additionsFromTable).toFixed(2);
  };

  const getTotalDeductions = () => {
    // Calculate deductions from salaryBreakdown table rows (negative amounts)
    return salaryBreakdown.reduce((sum, row) => {
      const amount = parseFloat(row.amount || '0');
      if (amount < 0) {
        return sum + Math.abs(amount); // Convert to positive for display
      }
      return sum;
    }, 0).toFixed(2);
  };

  const getAdditionsOnly = () => {
    // Return just the additions amount (without base gross)
    const basicComponents = ['Basic', 'House Rent', 'Medical Allowance', 'Conveyance', 'Stamp'];
    return salaryBreakdown.reduce((sum, row) => {
      const amount = parseFloat(row.amount || '0');
      const payrollHead = (row.payrollHead || '').trim();
      // Debug log to see what's being counted
      if (amount > 0 && !basicComponents.includes(payrollHead)) {
        console.log('Counting as addition:', payrollHead, amount);
        return sum + amount;
      }
      return sum;
    }, 0).toFixed(2);
  };

  const getNetPayable = () => {
    const withAdditions = parseFloat(getTotalWithAdditions());
    const deductions = parseFloat(getTotalDeductions());
    return (withAdditions - deductions).toFixed(2);
  };

  const calculateSalaryWithAdditions = () => {
    const gross = parseFloat(grossSalary || '0');
    if (isNaN(gross) || gross <= 0) {
      alert('Please enter a valid Gross Salary first');
      return;
    }

    // If user has existing breakdown, recalculate based on mode
    if (salaryBreakdown.length > 0) {
      // Fixed values for original formula mode
      const FIXED_MEDICAL = 450;
      const FIXED_TRANSPORT = 1250;
      const FIXED_FOOD = 750;
      const totalFixed = FIXED_MEDICAL + FIXED_TRANSPORT + FIXED_FOOD;

      // Percentage mode: Use new structure (Basic 50%, House Rent 30%, Medical Allowance 15%, Conveyance 5%)
      // Formula mode: Use fixed amounts (450, 1250, 750) with (Gross - Fixed) / 1.5
      let basicAmount: number;
      let houseRentAmount: number;
      let medicalAllowanceAmount: number;
      let conveyanceAmount: number;
      let basicType: string;
      let houseRentType: string;
      let medicalType: string;
      let conveyanceType: string;

      if (basicMode === 'percentage') {
        // Percentage mode: Fixed structure
        // Basic Salary (50%), House Rent (30%), Medical Allowance (15%), Conveyance (5%) = Total 100%
        basicAmount = gross * 0.50; // 50%
        houseRentAmount = gross * 0.30; // 30%
        medicalAllowanceAmount = gross * 0.15; // 15%
        conveyanceAmount = gross * 0.05; // 5%
        basicType = 'Percentage';
        houseRentType = 'Percentage';
        medicalType = 'Percentage';
        conveyanceType = 'Percentage';
      } else {
        // Formula mode: Keep original fixed amounts
        basicAmount = (gross - totalFixed) / 1.5;
        houseRentAmount = (gross - totalFixed) / 3;
        medicalAllowanceAmount = FIXED_MEDICAL; // 450
        conveyanceAmount = FIXED_TRANSPORT + FIXED_FOOD; // 1250 + 750 = 2000
        basicType = 'Formula';
        houseRentType = 'Formula';
        medicalType = 'Fixed';
        conveyanceType = 'Fixed';
      }

      // Calculate percentages based on gross
      const basicPct = ((basicAmount / gross) * 100).toFixed(2);
      const houseRentPct = ((houseRentAmount / gross) * 100).toFixed(2);
      const medicalAllowancePct = ((medicalAllowanceAmount / gross) * 100).toFixed(2);
      const conveyancePct = ((conveyanceAmount / gross) * 100).toFixed(2);

      const updatedBreakdown = salaryBreakdown.map((row) => {
        // Apply values based on payroll head and mode
        if (row.payrollHead === 'Medical Allowance') {
          const amount = basicMode === 'percentage' ? medicalAllowanceAmount.toFixed(2) : FIXED_MEDICAL.toFixed(2);
          const pct = basicMode === 'percentage' ? '15' : medicalAllowancePct;
          return { ...row, type: medicalType, amount, percentageFormula: pct };
        }
        if (row.payrollHead === 'Conveyance') {
          const amount = basicMode === 'percentage' ? conveyanceAmount.toFixed(2) : (FIXED_TRANSPORT + FIXED_FOOD).toFixed(2);
          const pct = basicMode === 'percentage' ? '5' : conveyancePct;
          return { ...row, type: conveyanceType, amount, percentageFormula: pct };
        }
        // Recalculate Basic based on mode
        if (row.payrollHead === 'Basic') {
          const pctValue = basicMode === 'percentage' ? '50' : `${basicPct}%`;
          return { ...row, type: basicType, amount: basicAmount.toFixed(2), percentageFormula: pctValue };
        }
        if (row.payrollHead === 'House Rent') {
          const pctValue = basicMode === 'percentage' ? houseRentPct : `${houseRentPct}%`;
          return { ...row, type: houseRentType, amount: houseRentAmount.toFixed(2), percentageFormula: pctValue };
        }
        // For other rows, keep as-is
        return row;
      });
      setSalaryBreakdown(updatedBreakdown);
    } else {
      // Fixed values for original formula mode
      const FIXED_MEDICAL = 450;
      const FIXED_TRANSPORT = 1250;
      const FIXED_FOOD = 750;
      const totalFixed = FIXED_MEDICAL + FIXED_TRANSPORT + FIXED_FOOD;

      // Percentage mode: Use new structure (Basic 50%, House Rent 30%, Medical Allowance 15%, Conveyance 5%)
      // Formula mode: Use fixed amounts (450, 1250, 750) with (Gross - Fixed) / 1.5
      let basicAmount: number;
      let houseRentAmount: number;
      let medicalAllowanceAmount: number;
      let conveyanceAmount: number;
      let basicType: string;
      let houseRentType: string;
      let medicalType: string;
      let conveyanceType: string;
      let basicPct: string;
      let houseRentPct: string;
      let medicalAllowancePct: string;
      let conveyancePct: string;

      if (basicMode === 'percentage') {
        // Percentage mode: Fixed structure
        // Basic Salary (50%), House Rent (30%), Medical Allowance (15%), Conveyance (5%) = Total 100%
        basicAmount = gross * 0.50; // 50%
        houseRentAmount = gross * 0.30; // 30%
        medicalAllowanceAmount = gross * 0.15; // 15%
        conveyanceAmount = gross * 0.05; // 5%
        basicType = 'Percentage';
        houseRentType = 'Percentage';
        medicalType = 'Percentage';
        conveyanceType = 'Percentage';
        basicPct = '50';
        houseRentPct = '30';
        medicalAllowancePct = '15';
        conveyancePct = '5';
      } else {
        // Formula mode: Keep original fixed amounts
        basicAmount = (gross - totalFixed) / 1.5;
        houseRentAmount = (gross - totalFixed) / 3;
        medicalAllowanceAmount = FIXED_MEDICAL; // 450
        conveyanceAmount = FIXED_TRANSPORT + FIXED_FOOD; // 1250 + 750 = 2000
        basicType = 'Formula';
        houseRentType = 'Formula';
        medicalType = 'Fixed';
        conveyanceType = 'Fixed';
        basicPct = ((basicAmount / gross) * 100).toFixed(2);
        houseRentPct = ((houseRentAmount / gross) * 100).toFixed(2);
        medicalAllowancePct = ((medicalAllowanceAmount / gross) * 100).toFixed(2);
        conveyancePct = ((conveyanceAmount / gross) * 100).toFixed(2);
      }

      // Create new default structure with values based on selected mode
      const baseStructure: SalaryBreakdown[] = [
        { id: 1, payrollHead: 'Basic', type: basicType, percentageFormula: basicPct, baseHead: 'Gross Salary', amount: basicAmount.toFixed(2), sequence: '1' },
        { id: 2, payrollHead: 'House Rent', type: houseRentType, percentageFormula: houseRentPct, baseHead: 'Gross Salary', amount: houseRentAmount.toFixed(2), sequence: '2' },
        { id: 3, payrollHead: 'Medical Allowance', type: medicalType, percentageFormula: medicalAllowancePct, baseHead: 'Gross Salary', amount: medicalAllowanceAmount.toFixed(2), sequence: '3' },
        { id: 4, payrollHead: 'Conveyance', type: conveyanceType, percentageFormula: conveyancePct, baseHead: 'Gross Salary', amount: conveyanceAmount.toFixed(2), sequence: '4' },
      ];

      let nextId = baseStructure.length + 1;
      let nextSeq = baseStructure.length + 1;

      // Add optional additions if enabled
      if (attendanceBonus.enabled && attendanceBonus.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Attendance Bonus',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: parseFloat(attendanceBonus.amount).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (incentive.enabled && incentive.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Incentive',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: parseFloat(incentive.amount).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      // Add ALL other additions
      otherAdditions.forEach((addition) => {
        if (addition.amount && addition.label) {
          baseStructure.push({
            id: nextId++,
            payrollHead: addition.label,
            type: 'Fixed',
            percentageFormula: '',
            baseHead: 'Gross Salary',
            amount: parseFloat(addition.amount).toFixed(2),
            sequence: (nextSeq++).toString(),
          });
        }
      });

      // Add optional deductions if enabled (stored as negative amounts)
      if (providentFund.enabled && providentFund.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Provident Fund',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(providentFund.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (advance.enabled && advance.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Advance',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(advance.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (stamp.enabled && stamp.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Stamp',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(stamp.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (transportDeduction.enabled && transportDeduction.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Transport Deduction',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(transportDeduction.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (lunchContribution.enabled && lunchContribution.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Lunch Contribution',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(lunchContribution.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (ait.enabled && ait.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'AIT',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(ait.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      if (punishmentAmount.enabled && punishmentAmount.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Punishment Amount',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(punishmentAmount.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }

      // Add ALL other deductions
      otherDeductions.forEach((deduction) => {
        if (deduction.amount && deduction.label) {
          baseStructure.push({
            id: nextId++,
            payrollHead: deduction.label,
            type: 'Fixed',
            percentageFormula: '',
            baseHead: 'Gross Salary',
            amount: (-parseFloat(deduction.amount)).toFixed(2),
            sequence: (nextSeq++).toString(),
          });
        }
      });

      setSalaryBreakdown(baseStructure);
    }
  };

  const buildSalaryBreakdownWithAdditions = (): SalaryBreakdown[] => {
    const gross = parseFloat(grossSalary || '0');
    const base: SalaryBreakdown[] = [];
    let nextId = 1;
    let nextSeq = 1;

    // Add existing breakdown if any
    if (salaryBreakdown.length > 0) {
      // Filter out optional additions/deductions first to rebuild them fresh
      const knownAdditions = ['Attendance Bonus', 'Incentive', 'Performance Bonus'];
      const knownDeductions = ['Provident Fund', 'Advance', 'Stamp', 'Transport Deduction', 'Lunch Contribution', 'AIT', 'Punishment Amount', 'Tax'];
      
      const coreRows = salaryBreakdown.filter(row => {
        const head = row.payrollHead || '';
        return !knownAdditions.includes(head) && 
               !knownDeductions.includes(head);
      });
      base.push(...coreRows.map((row, idx) => ({ ...row, id: nextId++, sequence: (nextSeq++).toString() })));
      nextId = base.length + 1;
      nextSeq = base.length + 1;
    }

    // Add Optional Salary Additions
    if (attendanceBonus.enabled && attendanceBonus.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Attendance Bonus',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: parseFloat(attendanceBonus.amount).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (incentive.enabled && incentive.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Incentive',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: parseFloat(incentive.amount).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    // Add ALL other additions
    otherAdditions.forEach((addition) => {
      if (addition.amount && addition.label) {
        base.push({
          id: nextId++,
          payrollHead: addition.label,
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: parseFloat(addition.amount).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }
    });

    // Add Optional Deductions (stored as negative amounts)
    if (providentFund.enabled && providentFund.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Provident Fund',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(providentFund.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (advance.enabled && advance.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Advance',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(advance.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (stamp.enabled && stamp.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Stamp',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(stamp.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (transportDeduction.enabled && transportDeduction.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Transport Deduction',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(transportDeduction.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (lunchContribution.enabled && lunchContribution.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Lunch Contribution',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(lunchContribution.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (ait.enabled && ait.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'AIT',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(ait.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    if (punishmentAmount.enabled && punishmentAmount.amount) {
      base.push({
        id: nextId++,
        payrollHead: 'Punishment Amount',
        type: 'Fixed',
        percentageFormula: '',
        baseHead: 'Gross Salary',
        amount: (-parseFloat(punishmentAmount.amount)).toFixed(2),
        sequence: (nextSeq++).toString(),
      });
    }

    // Add ALL other deductions
    otherDeductions.forEach((deduction) => {
      if (deduction.amount && deduction.label) {
        base.push({
          id: nextId++,
          payrollHead: deduction.label,
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(deduction.amount)).toFixed(2),
          sequence: (nextSeq++).toString(),
        });
      }
    });

    return base;
  };

  // Handle employee selection from search
  const handleEmployeeSelect = async (employee: EmployeeSuggestion) => {
    setSelectedEmployee(employee);
    setEmployeeError(null);
    setDuplicateError(null);
    
    // Auto-populate all 4 identity fields based on search type
    if (searchType === 'acc_no') {
      // When searching by AC-No., show AC-No. in search field
      setEmpCode(employee.acNo || employee.emp_code);
    } else {
      // When searching by name, show name in search field
      setEmpCode(employee.name || employee.full_name_english);
    }
    
    // Populate all 4 identity fields from employee data
    setEmpNo(employee.empNo || '');           // Emp No.
    setAcNo(employee.acNo || '');             // AC-No.
    setNo(employee.no || '');                 // No.
    setEmpName(employee.name || employee.full_name_english); // Name
    setEmpId(employee.empNo || '');           // Emp ID (for compatibility)
    setDepartment(employee.department || '');
    setDesignation(employee.designation || '');
    setCompany(employee.company || '');
    
    // Check if employee already has salary info
    try {
      setValidatingEmployee(true);
      const existing = await employeeSalaryInformationService.getByEmpCode(employee.emp_code);
      if (existing && existing.id) {
        // Redirect to edit page if salary record already exists
        if (confirm(`Employee ${employee.full_name_english} (${employee.emp_code}) already has salary information. Would you like to edit the existing record?`)) {
          router.push(`/employee-salary-information/${existing.id}/edit`);
        } else {
          setDuplicateError(`Employee ${employee.full_name_english} (${employee.emp_code}) already has salary information.`);
        }
        return;
      }
    } catch (err) {
      // Employee doesn't have salary info yet - good, proceed with new entry
    } finally {
      setValidatingEmployee(false);
    }
  };

  // Handle manual empCode input validation
  const handleEmpCodeChange = async (value: string) => {
    setEmpCode(value || '');
    setEmployeeError(null);
    setDuplicateError(null);
    setSelectedEmployee(null);
    
    if (value && value.length >= 2) {
      try {
        setValidatingEmployee(true);
        
        if (searchType === 'acc_no') {
          // For AC-No. search, use validateEmployee
          const result = await employeeService.validateEmployee(value);
          if (result.valid && result.employee) {
            const emp = result.employee;
            handleEmployeeSelect({
              id: emp.id,
              // 4 Identity Columns (required for EmployeeSuggestion)
              empNo: emp.empNo || emp.emp_id || '',
              acNo: emp.acNo || emp.emp_code || emp.punch_card || '',
              no: emp.no || emp.emp_code || '',
              name: emp.name || emp.full_name_english || '',
              // Legacy fields (for backward compatibility)
              emp_code: emp.emp_code || emp.acNo || emp.no || '',
              emp_id: emp.emp_id || emp.empNo || '',
              full_name_english: emp.full_name_english || emp.name || '',
              full_name_bangla: emp.full_name_bangla || '',
              department: emp.department || '',
              designation: emp.designation || '',
              company: emp.company || '',
            });
          } else {
            setEmployeeError(`Employee with AC-No. '${value}' not found in system.`);
          }
        } else {
          // For name search, use search suggestions and find exact match
          const suggestions = await employeeService.getSearchSuggestions(value, 10, 'name');
          const exactMatch = suggestions.find(emp => 
            emp.name && emp.name.toLowerCase() === value.toLowerCase().trim()
          );
          
          if (exactMatch) {
            handleEmployeeSelect({
              id: exactMatch.id,
              // 4 Identity Columns (already available from suggestions)
              empNo: exactMatch.empNo || '',
              acNo: exactMatch.acNo || '',
              no: exactMatch.no || '',
              name: exactMatch.name || '',
              // Legacy fields (for backward compatibility)
              emp_code: exactMatch.emp_code || exactMatch.acNo || exactMatch.no || '',
              emp_id: exactMatch.emp_id || exactMatch.empNo || '',
              full_name_english: exactMatch.full_name_english || exactMatch.name || '',
              full_name_bangla: exactMatch.full_name_bangla || '',
              department: exactMatch.department || '',
              designation: exactMatch.designation || '',
              company: exactMatch.company || '',
            });
          } else {
            setEmployeeError(`Employee with name '${value}' not found in system.`);
          }
        }
      } catch (err: any) {
        const searchTypeText = searchType === 'acc_no' ? 'AC-No.' : 'name';
        setEmployeeError(`Employee with ${searchTypeText} '${value}' not found in system.`);
        setSelectedEmployee(null);
      } finally {
        setValidatingEmployee(false);
      }
    } else if (value && value.length < 2) {
      // Clear validation when user deletes characters
      setSelectedEmployee(null);
    }
  };

  const handleSave = async () => {
    if (!empCode.trim()) {
      setEmployeeError('Emp Code is required');
      return;
    }

    if (!selectedEmployee) {
      setEmployeeError('Please select a valid employee from the system.');
      return;
    }

    setLoading(true);
    try {
      // Build final salary breakdown with all additions and deductions
      const finalSalaryBreakdown = buildSalaryBreakdownWithAdditions();

      await employeeSalaryInformationService.create({
        empCode,
        empId,
        empName,
        empNo,    // Send Emp No.
        acNo,      // Send AC-No.
        no,        // Send No.
        category,
        company,
        location,
        division,
        department,
        section: department,
        subsection: department,
        designation,
        sGrade,
        stSalary,
        grossSalary,
        bGross,
        cashDisbursement,
        policy,
        mode,
        bankInfos,
        salaryBreakdown: finalSalaryBreakdown,
        totalAdditions: getAdditionsOnly(),
        totalDeductions: getTotalDeductions(),
        netPayable: getNetPayable(),
      });
      router.push('/employee-salary-information');
    } catch (err: any) {
      console.error('Failed to save:', err);
      alert('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (confirm('Clear all fields?')) {
      setEmpCode('');
      setEmpId('');
      setEmpName('');
      setEmpNo('');    // Clear Emp No.
      setAcNo('');      // Clear AC-No.
      setNo('');        // Clear No.
      setCategory('');
      setCompany('');
      setLocation('');
      setDivision('');
      setDepartment('');
      setSection('');
      setSubsection('');
      setDesignation('');
      setSGrade('');
      setStSalary('');
      setGrossSalary('');
      setBGross('');
      setCashDisbursement('No');
      setPolicy('');
      setMode('Actual');
      setBankInfos([
        {
          id: 1,
          salaryBank: '',
          branchName: '',
          accountNo: '',
          salaryAmount: '',
          salaryPeriod: '',
          showTax: 'Yes',
          sequence: '1',
        },
      ]);
      setSalaryBreakdown([]);
      setAttendanceBonus({ enabled: false, amount: '' });
      setIncentive({ enabled: false, amount: '' });
      setOtherAdditions([]);
      setProvidentFund({ enabled: false, amount: '' });
      setAdvance({ enabled: false, amount: '' });
      setStamp({ enabled: false, amount: '' });
      setTransportDeduction({ enabled: false, amount: '' });
      setLunchContribution({ enabled: false, amount: '' });
      setAit({ enabled: false, amount: '' });
      setPunishmentAmount({ enabled: false, amount: '' });
      setOtherDeductions([]);
    }
  };

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Add Employee Salary Information</h4>
          <p className="text-muted mb-0 small">Create new salary record</p>
        </div>
        <Link href="/employee-salary-information" className="btn btn-outline-secondary">
          <i className="fas fa-arrow-left me-2"></i> Back to List
        </Link>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-user me-2"></i>Employee Details
          </h5>
          <div className="row g-3">
            <div className="col-md-6">
              <EmployeeSearch
                label="Search Employee *"
                value={empCode}
                onChange={handleEmpCodeChange}
                onSelect={handleEmployeeSelect}
                onSearchTypeChange={setSearchType}
                searchType={searchType}
                placeholder={searchType === 'acc_no' ? 'Enter AC-No.' : 'Enter employee name...'}
                required
              />
              {employeeError && <div className="invalid-feedback d-block">{employeeError}</div>}
              {duplicateError && <div className="invalid-feedback d-block">{duplicateError}</div>}
              {validatingEmployee && (
                <div className="small text-muted mt-1">
                  <i className="fas fa-spinner fa-spin me-1"></i> Validating employee...
                </div>
              )}
              {selectedEmployee && !employeeError && !duplicateError && (
                <div className="small text-success mt-1">
                  <i className="fas fa-check-circle me-1"></i> 
                  {selectedEmployee.full_name_english} validated
                </div>
              )}
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Emp No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={empNo}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">AC-No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={acNo}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">No.</label>
              <input
                type="text"
                className="form-control"
                placeholder="Auto-populated"
                value={no}
                readOnly
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Name</label>
              <input
                type="text"
                className="form-control"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="Staff">Staff</option>
                <option value="Worker">Worker</option>
                <option value="Management">Management</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Company</label>
              <select
                className="form-select"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Select Company</option>
                <option value="Skyview Online Ltd.">Skyview Online Ltd.</option>
                <option value="Greenmax Technologies Ltd.">Greenmax Technologies Ltd.</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Location</label>
              <select
                className="form-select"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location</option>
                <option value="Head Office">Head Office</option>
                <option value="Corporate Office">Corporate Office</option>
                <option value="Branch Office">Branch Office</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Division</label>
              <select
                className="form-select"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                <option value="">Select Division</option>
                <option value="Accounts & Billing">Accounts & Billing</option>
                <option value="NOC">NOC</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Transmission">Transmission</option>
                <option value="Legal">Legal</option>
                <option value="Call Center & Support">Call Center & Support</option>
                <option value="Maintenance">Maintenance</option>
                <option value="General Administration">General Administration</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Department</label>
              <select
                className="form-select"
                value={department}
                onChange={(e) => {
                  const value = e.target.value;
                  setDepartment(value);
                  setSection(value);
                  setSubsection(value);
                }}
              >
                <option value="">Select Department</option>
                <option value="Accounts & Billing">Accounts & Billing</option>
                <option value="NOC">NOC</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Transmission">Transmission</option>
                <option value="Legal">Legal</option>
                <option value="Call Center & Support">Call Center & Support</option>
                <option value="Maintenance">Maintenance</option>
                <option value="General Administration">General Administration</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Section</label>
              <select
                className="form-select"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">Select Section</option>
                <option value="Accounts & Billing">Accounts & Billing</option>
                <option value="NOC">NOC</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Transmission">Transmission</option>
                <option value="Legal">Legal</option>
                <option value="Call Center & Support">Call Center & Support</option>
                <option value="Maintenance">Maintenance</option>
                <option value="General Administration">General Administration</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Subsection</label>
              <select
                className="form-select"
                value={subsection}
                onChange={(e) => setSubsection(e.target.value)}
              >
                <option value="">Select Subsection</option>
                <option value="Accounts & Billing">Accounts & Billing</option>
                <option value="NOC">NOC</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Transmission">Transmission</option>
                <option value="Legal">Legal</option>
                <option value="Call Center & Support">Call Center & Support</option>
                <option value="Maintenance">Maintenance</option>
                <option value="General Administration">General Administration</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Designation</label>
              <select
                className="form-select"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              >
                <option value="">Select Designation</option>
                <option value="Manager">Manager</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Officer">Officer</option>
                <option value="Staff">Staff</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="mb-3 fw-bold text-primary">
            <i className="fas fa-money-bill-wave me-2"></i>Salary Information
          </h5>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-medium">S. Grade</label>
              <input
                type="text"
                className="form-control"
                placeholder="Salary Grade"
                value={sGrade}
                onChange={(e) => setSGrade(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">St. Salary</label>
              <input
                type="text"
                className="form-control"
                placeholder="Standard Salary"
                value={stSalary}
                onChange={(e) => setStSalary(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Gross Salary</label>
              <input
                type="text"
                className="form-control"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">B Gross</label>
              <input
                type="text"
                className="form-control"
                placeholder="Basic Gross"
                value={bGross}
                onChange={(e) => setBGross(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Cash Disbursement</label>
              <select
                className="form-select"
                value={cashDisbursement}
                onChange={(e) => setCashDisbursement(e.target.value)}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Policy</label>
              <select
                className="form-select"
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
              >
                <option value="">Select Policy</option>
                <option value="Standard 2026">Standard 2026</option>
                <option value="Policy A">Policy A</option>
                <option value="Policy B">Policy B</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Mode</label>
              <select
                className="form-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="Actual">Actual</option>
                <option value="Estimated">Estimated</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-primary mb-0">
              <i className="fas fa-university me-2"></i>Bank Information
            </h5>
            <button className="btn btn-outline-primary btn-sm" onClick={addBankInfoRow}>
              <i className="fas fa-plus me-1"></i>Add Row
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '15%' }}>Salary Bank</th>
                  <th style={{ width: '15%' }}>Branch Name</th>
                  <th style={{ width: '15%' }}>Account No</th>
                  <th style={{ width: '15%' }}>Salary Amount</th>
                  <th style={{ width: '12%' }}>Salary Period</th>
                  <th style={{ width: '10%' }}>Show Tax</th>
                  <th style={{ width: '8%' }}>Sequence</th>
                  <th style={{ width: '10%' }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bankInfos.map((bank) => (
                  <tr key={bank.id}>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={bank.salaryBank}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'salaryBank', e.target.value)}
                      >
                        <option value="">Select Bank</option>
                        <option value="Bank A">Bank A</option>
                        <option value="Bank B">Bank B</option>
                        <option value="Bank C">Bank C</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={bank.branchName}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'branchName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={bank.accountNo}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'accountNo', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={bank.salaryAmount}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'salaryAmount', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={bank.salaryPeriod}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'salaryPeriod', e.target.value)}
                      >
                        <option value="">Select Period</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Bi-weekly">Bi-weekly</option>
                        <option value="Weekly">Weekly</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={bank.showTax}
                        onChange={(e) => handleBankInfoChange(bank.id || 0, 'showTax', e.target.value)}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={bank.sequence}
                        readOnly
                      />
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeBankInfoRow(bank.id || 0)}
                        disabled={bankInfos.length === 1}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Professional Salary Breakdown - Integrated Additions & Deductions */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3" style={{ backgroundColor: '#e3f2fd', padding: '10px', borderRadius: '4px' }}>
            <h5 className="fw-bold mb-0" style={{ color: '#1976d2' }}>
              <i className="fas fa-calculator me-2"></i>Salary Breakdown
            </h5>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" onClick={addBreakdownRow}>
                <i className="fas fa-plus me-1"></i>Add Row
              </button>
              <button className="btn btn-primary btn-sm" onClick={calculateSalaryWithAdditions}>
                <i className="fas fa-calculator me-1"></i>Calculate
              </button>
            </div>
          </div>
          <div className="mb-3 d-flex align-items-center gap-2">
            <label className="form-label fw-medium mb-0">Basic Calculation:</label>
            <select
              className="form-select form-select-sm w-auto"
              value={basicMode}
              onChange={(e) => setBasicMode(e.target.value as 'formula' | 'percentage')}
            >
              <option value="formula">Formula (Auto-balanced)</option>
              <option value="percentage">Percentage (50% Fixed)</option>
            </select>
            <small className="text-muted">
              {basicMode === 'formula' ? 'Basic = (Gross - Fixed) / 1.5' : 'Basic = Gross × 50%'}
            </small>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '20%' }}>Payroll Head</th>
                  <th style={{ width: '15%' }}>Type</th>
                  <th style={{ width: '15%' }}>Percentage/Formula</th>
                  <th style={{ width: '20%' }}>Base Head</th>
                  <th style={{ width: '15%' }}>Amount</th>
                  <th style={{ width: '8%' }}>Seq</th>
                  <th style={{ width: '7%' }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaryBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Click "Calculate" to generate salary breakdown based on Gross Salary
                    </td>
                  </tr>
                )}
                {salaryBreakdown.map((row) => {
                  const basicComponents = ['Basic', 'House Rent', 'Medical Allowance', 'Conveyance', 'Stamp'];
                  const isBasic = basicComponents.includes(row.payrollHead);
                  const isAddition = ['Attendance Bonus', 'Incentive', 'Performance Bonus'].includes(row.payrollHead) || 
                    (parseFloat(row.amount || '0') > 0 && !isBasic && row.payrollHead !== '');
                  const isDeduction = parseFloat(row.amount || '0') < 0 ||
                    ['Provident Fund', 'Advance', 'Transport Deduction', 'Lunch Contribution', 'AIT', 'Punishment Amount'].includes(row.payrollHead);
                  const rowClass = isDeduction ? 'table-danger' : isAddition ? 'table-success' : '';
                  // Payroll Head is editable only for basic structure rows
                  const isPayrollHeadEditable = isBasic || row.payrollHead === '';
                  
                  return (
                  <tr key={row.id} className={rowClass}>
                    <td>
                      {isPayrollHeadEditable ? (
                        <select
                          className="form-select form-select-sm"
                          value={row.payrollHead}
                          onChange={(e) => handleBreakdownChange(row.id || 0, 'payrollHead', e.target.value)}
                        >
                          <option value="">Select Head</option>
                          <optgroup label="Basic Structure">
                            <option value="Basic">Basic</option>
                            <option value="House Rent">House Rent</option>
                            <option value="Medical Allowance">Medical Allowance</option>
                            <option value="Conveyance">Conveyance</option>
                            <option value="Stamp">Stamp</option>
                          </optgroup>
                          <optgroup label="Additions">
                            <option value="Attendance Bonus">Attendance Bonus</option>
                            <option value="Incentive">Incentive</option>
                            <option value="Performance Bonus">Performance Bonus</option>
                          </optgroup>
                          <optgroup label="Deductions">
                            <option value="Provident Fund">Provident Fund</option>
                            <option value="Advance">Advance</option>
                            <option value="Transport Deduction">Transport Deduction</option>
                            <option value="Lunch Contribution">Lunch Contribution</option>
                            <option value="AIT">AIT</option>
                            <option value="Punishment Amount">Punishment Amount</option>
                          </optgroup>
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={row.payrollHead}
                          readOnly
                          title="Payroll Head cannot be changed for additions/deductions"
                        />
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={row.type}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'type', e.target.value)}
                      >
                        <option value="Percentage">Percentage</option>
                        <option value="Formula">Formula</option>
                        <option value="Fixed">Fixed</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.percentageFormula}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'percentageFormula', e.target.value)}
                        placeholder="e.g., 50"
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={row.baseHead}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'baseHead', e.target.value)}
                      >
                        <option value="Gross Salary">Gross Salary</option>
                        <option value="Basic">Basic</option>
                        <option value="Medical Allowance">Medical Allowance</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.amount}
                        readOnly={row.type !== 'Fixed'}
                        onChange={(e) => {
                          if (row.type === 'Fixed') {
                            handleBreakdownChange(row.id || 0, 'amount', e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.sequence}
                        readOnly
                      />
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeBreakdownRow(row.id || 0)}
                        title="Delete Row"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {salaryBreakdown.length > 0 && (
                  <tr className="table-active fw-bold">
                    <td colSpan={4} className="text-end">Total Amount:</td>
                    <td>{getTotalAmount()}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {salaryBreakdown.length > 0 && (
            <div className="mt-3 p-3 bg-light rounded">
              <div className="row align-items-center">
                <div className="col-md-2">
                  <span className="text-muted">Gross Salary: </span>
                  <span className="fw-bold">{parseFloat(grossSalary || '0').toFixed(2)}</span>
                </div>
                <div className="col-md-2 text-center">
                  <span className="text-success">+ {getAdditionsOnly()}</span>
                  <div className="small text-muted">Additions</div>
                </div>
                <div className="col-md-2 text-center">
                  <span className="text-danger">- {getTotalDeductions()}</span>
                  <div className="small text-muted">Deductions</div>
                </div>
                <div className="col-md-2 text-center">
                  <span className="text-muted">=</span>
                </div>
                <div className="col-md-4 text-md-end">
                  <span className="text-muted">Net Payable: </span>
                  <span className="fw-bold text-primary fs-4">{getNetPayable()}</span>
                </div>
              </div>
              {getTotalAmount() !== getNetPayable() && (
                <div className="mt-2 text-center text-warning small">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Breakdown total ({getTotalAmount()}) differs from net payable ({getNetPayable()})
                </div>
              )}
            </div>
          )}

          {/* Quick Add Section - Below the Table */}
          <div className="mt-3 p-3 bg-light border rounded">
            <div className="row g-3">
              {/* Additions Dropdown */}
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-success"><i className="fas fa-plus me-1"></i>Additions</span>
                </div>
                <div className="input-group">
                  <select
                    className="form-select"
                    value={selectedAddition}
                    onChange={(e) => setSelectedAddition(e.target.value)}
                  >
                    <option value="">Select Addition Type</option>
                    <option value="Attendance Bonus">Attendance Bonus</option>
                    <option value="Incentive">Incentive</option>
                    <option value="Performance Bonus">Performance Bonus</option>
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {selectedAddition === 'Other' && (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter label"
                      value={customAdditionLabel}
                      onChange={(e) => setCustomAdditionLabel(e.target.value)}
                      style={{ maxWidth: '150px' }}
                    />
                  )}
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Amount"
                    value={additionAmount}
                    onChange={(e) => setAdditionAmount(e.target.value)}
                    style={{ maxWidth: '120px' }}
                  />
                  <button
                    className="btn btn-success"
                    type="button"
                    onClick={() => addFromDropdown('addition')}
                    disabled={!selectedAddition || !additionAmount || (selectedAddition === 'Other' && !customAdditionLabel)}
                  >
                    <i className="fas fa-plus"></i> Add
                  </button>
                </div>
              </div>

              {/* Deductions Dropdown */}
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-danger"><i className="fas fa-minus me-1"></i>Deductions</span>
                </div>
                <div className="input-group">
                  <select
                    className="form-select"
                    value={selectedDeduction}
                    onChange={(e) => setSelectedDeduction(e.target.value)}
                  >
                    <option value="">Select Deduction Type</option>
                    <option value="Provident Fund">Provident Fund</option>
                    <option value="Advance">Advance</option>
                    <option value="Stamp">Stamp</option>
                    <option value="AIT">AIT</option>
                    <option value="Transport Deduction">Transport Deduction</option>
                    <option value="Lunch Contribution">Lunch Contribution</option>
                    <option value="Punishment Amount">Punishment Amount</option>
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {selectedDeduction === 'Other' && (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter label"
                      value={customDeductionLabel}
                      onChange={(e) => setCustomDeductionLabel(e.target.value)}
                      style={{ maxWidth: '150px' }}
                    />
                  )}
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Amount"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    style={{ maxWidth: '120px' }}
                  />
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => addFromDropdown('deduction')}
                    disabled={!selectedDeduction || !deductionAmount || (selectedDeduction === 'Other' && !customDeductionLabel)}
                  >
                    <i className="fas fa-plus"></i> Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-success" onClick={calculateSalaryWithAdditions}>
              <i className="fas fa-calculator me-2"></i>Calculate
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>Save
                </>
              )}
            </button>
            <button className="btn btn-info text-white" disabled={!empCode || loading}>
              <i className="fas fa-edit me-2"></i>Update
            </button>
            <button className="btn btn-danger" disabled={!empCode || loading}>
              <i className="fas fa-trash me-2"></i>Delete
            </button>
            <button className="btn btn-outline-secondary" onClick={handleRefresh} disabled={loading}>
              <i className="fas fa-sync-alt me-2"></i>Refresh
            </button>
            <Link href="/employee-salary-information" className="btn btn-outline-secondary">
              <i className="fas fa-times me-2"></i>Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
