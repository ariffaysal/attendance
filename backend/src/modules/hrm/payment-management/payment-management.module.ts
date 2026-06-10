import { Module } from '@nestjs/common';
import { PaymentManagementController } from './payment-management.controller';
import { PaymentManagementService } from './payment-management.service';

@Module({
  controllers: [PaymentManagementController],
  providers: [PaymentManagementService],
  exports: [PaymentManagementService],
})
export class PaymentManagementModule {}
