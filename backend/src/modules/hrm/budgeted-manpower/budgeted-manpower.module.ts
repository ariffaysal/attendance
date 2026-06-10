import { Module } from '@nestjs/common';
import { BudgetedManpowerController } from './budgeted-manpower.controller';
import { BudgetedManpowerService } from './budgeted-manpower.service';

@Module({
  controllers: [BudgetedManpowerController],
  providers: [BudgetedManpowerService],
  exports: [BudgetedManpowerService],
})
export class BudgetedManpowerModule {}
