import { Module } from '@nestjs/common';
import { ApprovalTrackingController } from './approval-tracking.controller';
import { ApprovalTrackingService } from './approval-tracking.service';

@Module({
  controllers: [ApprovalTrackingController],
  providers: [ApprovalTrackingService],
  exports: [ApprovalTrackingService],
})
export class ApprovalTrackingModule {}
