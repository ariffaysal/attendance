'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { employeeSalaryInformationService } from '@/services/employee-salary-information.service';
import { BankInfo, EmployeeSalaryInformation, SalaryBreakdown } from '@/types/employee-salary-information';

export default function EditEmployeeSalaryInformationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [empCode, setEmpCode] = useState('');
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
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
  const [stampDeduction, setStampDeduction] = useState({ enabled: false, amount: '' });
  const [transportDeduction, setTransportDeduction] = useState({ enabled: false, amount: '' });
  const [lunchContribution, setLunchContribution] = useState({ enabled: false, amount: '' });
  const [ait, setAit] = useState({ enabled: false, amount: '' });
  const [punishmentAmount, setPunishmentAmount] = useState({ enabled: false, amount: '' });
  const [otherDeductions, setOtherDeductions] = useState<{id: number, label: string, amount: string}[]>([]);

  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdown[]>([]);
  const [basicMode, setBasicMode] = useState<'formula' | 'percentage'>('percentage');

  // Dropdown selection states for quick add
  const [selectedAddition, setSelectedAddition] = useState('');
  const [selectedDeduction, setSelectedDeduction] = useState('');
  const [additionAmount, setAdditionAmount] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [customAdditionLabel, setCustomAdditionLabel] = useState('');
  const [customDeductionLabel, setCustomDeductionLabel] = useState('');

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

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id]);

  async function loadRecord() {
    setLoading(true);
    setError(null);
    try {
      const data = await employeeSalaryInformationService.getById(Number(id));
      populateForm(data);
    } catch (err: any) {
      console.error('Failed to load record:', err);
      setError(err.message || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  }

  function populateForm(data: EmployeeSalaryInformation) {
    setEmpCode(data.empCode || '');
    setEmpId(data.empId || '');
    setEmpName(data.empName || '');
    setCategory(data.category || '');
    setCompany(data.company || '');
    setLocation(data.location || '');
    setDivision(data.division || '');
    setDepartment(data.department || '');
    setSection(data.department || '');
    setSubsection(data.department || '');
    setDesignation(data.designation || '');
    setSGrade(data.sGrade || '');
    setStSalary(data.stSalary || '');
    setGrossSalary(data.grossSalary || '');
    setBGross(data.bGross || '');
    setCashDisbursement(data.cashDisbursement || 'No');
    setPolicy(data.policy || '');
    setMode(data.mode || 'Actual');
    
    // Load optional additions if available
    if (data.salaryBreakdown) {
      console.log('Loading salaryBreakdown:', data.salaryBreakdown);
      
      const attendanceRow = data.salaryBreakdown.find(row => row.payrollHead === 'Attendance Bonus');
      if (attendanceRow) {
        setAttendanceBonus({ enabled: true, amount: attendanceRow.amount || '' });
      } else {
        setAttendanceBonus({ enabled: false, amount: '' });
      }
      
      const incentiveRow = data.salaryBreakdown.find(row => row.payrollHead === 'Incentive');
      if (incentiveRow) {
        setIncentive({ enabled: true, amount: incentiveRow.amount || '' });
      } else {
        setIncentive({ enabled: false, amount: '' });
      }
      
      // Load ALL other additions (multiple)
      console.log('Processing each row:');
      const otherAddRows = data.salaryBreakdown.filter(row => {
        const head = row.payrollHead || '';
        const amount = parseFloat(row.amount || '0');
        const isKnownAddition = ['Attendance Bonus', 'Incentive', 'Performance Bonus'].includes(head);
        const isBasicComponent = ['Basic', 'House Rent', 'Medical', 'Transport', 'Food'].includes(head);
        const isDeduction = ['Provident Fund', 'Advance', 'Stamp', 'Tax', 'AIT', 'Punishment Amount', 'Transport Deduction', 'Lunch Contribution'].includes(head);
        
        const shouldInclude = isKnownAddition || (amount > 0 && !isBasicComponent && !isDeduction);
        console.log(`  Head: "${head}", Amount: ${amount}, Include: ${shouldInclude}`);
        return shouldInclude;
      });
      
      console.log('Filtered otherAddRows:', otherAddRows);
      
      setOtherAdditions(otherAddRows.map((row, idx) => ({ 
        id: idx + 1, 
        label: row.payrollHead, 
        amount: row.amount || '' 
      })));

      // Load optional deductions if available (stored as negative amounts or specific payroll heads)
      const pfRow = data.salaryBreakdown.find(row => row.payrollHead === 'Provident Fund');
      if (pfRow) {
        setProvidentFund({ enabled: true, amount: Math.abs(parseFloat(pfRow.amount || '0')).toString() });
      } else {
        setProvidentFund({ enabled: false, amount: '' });
      }

      const advanceRow = data.salaryBreakdown.find(row => row.payrollHead === 'Advance');
      if (advanceRow) {
        setAdvance({ enabled: true, amount: Math.abs(parseFloat(advanceRow.amount || '0')).toString() });
      } else {
        setAdvance({ enabled: false, amount: '' });
      }

      const stampRow = data.salaryBreakdown.find(row => row.payrollHead === 'Stamp');
      if (stampRow) {
        setStampDeduction({ enabled: true, amount: Math.abs(parseFloat(stampRow.amount || '0')).toString() });
      } else {
        setStampDeduction({ enabled: false, amount: '' });
      }

      const transportDedRow = data.salaryBreakdown.find(row => row.payrollHead === 'Transport Deduction');
      if (transportDedRow) {
        setTransportDeduction({ enabled: true, amount: Math.abs(parseFloat(transportDedRow.amount || '0')).toString() });
      } else {
        setTransportDeduction({ enabled: false, amount: '' });
      }

      const lunchRow = data.salaryBreakdown.find(row => row.payrollHead === 'Lunch Contribution');
      if (lunchRow) {
        setLunchContribution({ enabled: true, amount: Math.abs(parseFloat(lunchRow.amount || '0')).toString() });
      } else {
        setLunchContribution({ enabled: false, amount: '' });
      }

      const aitRow = data.salaryBreakdown.find(row => row.payrollHead === 'AIT');
      if (aitRow) {
        setAit({ enabled: true, amount: Math.abs(parseFloat(aitRow.amount || '0')).toString() });
      } else {
        setAit({ enabled: false, amount: '' });
      }

      const punishmentRow = data.salaryBreakdown.find(row => row.payrollHead === 'Punishment Amount');
      if (punishmentRow) {
        setPunishmentAmount({ enabled: true, amount: Math.abs(parseFloat(punishmentRow.amount || '0')).toString() });
      } else {
        setPunishmentAmount({ enabled: false, amount: '' });
      }

      // Find other deduction (negative amount or specific label)
      // Load ALL other deductions (multiple)
      const knownDeductions = ['Provident Fund', 'Advance', 'Stamp', 'Transport Deduction', 
        'Lunch Contribution', 'AIT', 'Punishment Amount', 'Tax'];
      
      console.log('Processing deductions:');
      const otherDedRows = data.salaryBreakdown.filter(row => {
        const head = row.payrollHead || '';
        const amount = parseFloat(row.amount || '0');
        const isKnownDeduction = knownDeductions.includes(head);
        const shouldInclude = amount < 0 && !isKnownDeduction;
        console.log(`  Head: "${head}", Amount: ${amount}, Known: ${isKnownDeduction}, Include: ${shouldInclude}`);
        return shouldInclude;
      });
      
      console.log('Filtered otherDedRows:', otherDedRows);
      
      setOtherDeductions(otherDedRows.map((row, idx) => ({ 
        id: idx + 1, 
        label: row.payrollHead, 
        amount: Math.abs(parseFloat(row.amount || '0')).toString() 
      })));
    }
    
    if (data.bankInfos && data.bankInfos.length > 0) {
      setBankInfos(data.bankInfos.map((b, i) => ({
        ...b,
        id: b.id || i + 1,
        sequence: String(b.sequence || (i + 1)),
      })));
    }
    
    if (data.salaryBreakdown && data.salaryBreakdown.length > 0) {
      // Keep ALL breakdown items in the table (including Other items)
      // The otherAdditions/otherDeductions arrays track them for save purposes
      setSalaryBreakdown(data.salaryBreakdown.map((b, i) => ({
        ...b,
        id: b.id || i + 1,
        sequence: String(b.sequence || (i + 1)),
      })));
    } else {
      setSalaryBreakdown([]);
    }
  }

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

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await employeeSalaryInformationService.update(Number(id), {
        empCode,
        empId,
        empName,
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
        salaryBreakdown,
        totalAdditions: getAdditionsOnly(),
        totalDeductions: getTotalDeductions(),
        netPayable: getNetPayable(),
      });
      router.push('/employee-salary-information');
    } catch (err: any) {
      console.error('Failed to update:', err);
      alert('Failed to update: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    setSaving(true);
    try {
      await employeeSalaryInformationService.delete(Number(id));
      router.push('/employee-salary-information');
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Salary Breakdown Functions
  const handleBreakdownChange = (id: number, field: keyof SalaryBreakdown, value: string) => {
    setSalaryBreakdown((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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
        type: 'Fixed',
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

  const calculateSalaryWithAdditions = () => {
    const gross = parseFloat(grossSalary || '0');
    if (isNaN(gross) || gross <= 0) {
      alert('Please enter a valid Gross Salary first');
      return;
    }

    // If user has existing breakdown, enforce fixed values and recalculate
    if (salaryBreakdown.length > 0) {
      // Fixed values for Medical, Transport, Food
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
        // Apply values based on payroll head
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
      // Fixed values for Medical, Transport, Food
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

      if (stampDeduction.enabled && stampDeduction.amount) {
        baseStructure.push({
          id: nextId++,
          payrollHead: 'Stamp',
          type: 'Fixed',
          percentageFormula: '',
          baseHead: 'Gross Salary',
          amount: (-parseFloat(stampDeduction.amount)).toFixed(2),
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
      if (amount > 0 && !basicComponents.includes(payrollHead)) {
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

  // Helper functions for quick add
  const quickAddRow = (payrollHead: string, amount: string, isDeduction: boolean = false) => {
    const finalAmount = isDeduction ? (-parseFloat(amount || '0')).toFixed(2) : parseFloat(amount || '0').toFixed(2);

    setSalaryBreakdown((prev) => {
      const newId = prev.length > 0 ? Math.max(...prev.map((b) => b.id || 0)) + 1 : 1;
      const newSequence = (prev.length + 1).toString();

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

  // Add from dropdown selection
  const addFromDropdown = (type: 'addition' | 'deduction') => {
    if (type === 'addition' && selectedAddition && additionAmount) {
      const label = selectedAddition === 'Other' ? customAdditionLabel : selectedAddition;
      if (selectedAddition === 'Other' && !label) return;
      
      // ALWAYS add to otherAdditions array so it's saved properly
      setOtherAdditions(prev => [...prev, {
        id: prev.length + 1,
        label: label,
        amount: additionAmount
      }]);
      
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

  const handleRefresh = () => {
    if (confirm('Reload data?')) {
      loadRecord();
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-60">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading salary information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-60">
        <div className="text-center">
          <div className="alert alert-danger">
            <i className="fas fa-exclamation-circle me-2"></i>
            {error}
          </div>
          <button className="btn btn-primary mt-3" onClick={() => router.push('/employee-salary-information')}>
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="top-bar mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h4 className="mb-1 fw-bold">Edit Employee Salary Information</h4>
          <p className="text-muted mb-0 small">Update salary record for Emp Code: {empCode}</p>
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
            <div className="col-md-3">
              <label className="form-label fw-medium">Emp Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="Emp Code"
                value={empCode}
                disabled
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium">Emp ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="Browse or Write"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium">Emp Name</label>
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

      {/* Salary Breakdown */}
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
                  <th style={{ width: '12%' }}>Type</th>
                  <th style={{ width: '15%' }}>Percentage/Formula</th>
                  <th style={{ width: '18%' }}>Base Head</th>
                  <th style={{ width: '12%' }}>Amount</th>
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
                        value={row.type || 'Fixed'}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'type', e.target.value)}
                      >
                        <option value="Percentage">Percentage</option>
                        <option value="Fixed">Fixed</option>
                        <option value="Formula">Formula</option>
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
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.baseHead}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'baseHead', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.amount}
                        onChange={(e) => handleBreakdownChange(row.id || 0, 'amount', e.target.value)}
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
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Updating...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>Update
                </>
              )}
            </button>
            <button className="btn btn-outline-danger" onClick={handleDelete} disabled={saving}>
              <i className="fas fa-trash-alt me-2"></i>Delete
            </button>
            <button className="btn btn-outline-secondary" onClick={handleRefresh} disabled={saving}>
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
