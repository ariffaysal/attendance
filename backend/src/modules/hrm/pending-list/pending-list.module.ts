import { Module } from '@nestjs/common';
import { PendingListController } from './pending-list.controller';
import { PendingListService } from './pending-list.service';

@Module({
  controllers: [PendingListController],
  providers: [PendingListService],
  exports: [PendingListService],
})
export class PendingListModule {}
