import { Module } from '@nestjs/common';
import { SetupDataController } from './setup-data.controller';
import { SetupDataService } from './setup-data.service';
import { DutyRosterService } from './duty-roster.service';
import { ShiftController } from './shift.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SetupDataController, ShiftController],
  providers: [SetupDataService, DutyRosterService],
  exports: [SetupDataService, DutyRosterService],
})
export class SetupDataModule {}
