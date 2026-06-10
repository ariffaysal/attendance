import { Module } from '@nestjs/common';
import { ApprovalTrackingModule } from './approval-tracking/approval-tracking.module';
import { AttendanceManagementModule } from './attendance-management/attendance-management.module';
import { LeaveManagementModule } from './leave-management/leave-management.module';
import { BudgetedManpowerModule } from './budgeted-manpower/budgeted-manpower.module';
import { SetupDataModule } from './setup-data/setup-data.module';
import { DisciplinaryModule } from './disciplinary/disciplinary.module';
import { EmployeeInfoModule } from './employee-info/employee-info.module';
import { PaymentManagementModule } from './payment-management/payment-management.module';
import { PendingListModule } from './pending-list/pending-list.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ApprovalTrackingModule,
    AttendanceManagementModule,
    LeaveManagementModule,
    BudgetedManpowerModule,
    SetupDataModule,
    DisciplinaryModule,
    EmployeeInfoModule,
    PaymentManagementModule,
    PendingListModule,
    ReportsModule,
  ],
  exports: [
    ApprovalTrackingModule,
    AttendanceManagementModule,
    LeaveManagementModule,
    BudgetedManpowerModule,
    SetupDataModule,
    DisciplinaryModule,
    EmployeeInfoModule,
    PaymentManagementModule,
    PendingListModule,
    ReportsModule,
  ],
})
export class HrmModule {}
