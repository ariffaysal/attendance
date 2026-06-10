import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ZktecoMachineModule } from '../zkteco-machine/zkteco-machine.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [DatabaseModule, ZktecoMachineModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
