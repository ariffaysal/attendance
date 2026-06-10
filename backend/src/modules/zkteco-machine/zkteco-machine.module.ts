import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ZktecoMachineService } from './zkteco-machine.service';
import { ZktecoMachineController } from './zkteco-machine.controller';
import { AttendanceGateway } from './attendance.gateway';

@Module({
  imports: [DatabaseModule],
  providers: [ZktecoMachineService, AttendanceGateway],
  controllers: [ZktecoMachineController],
  exports: [ZktecoMachineService, AttendanceGateway],
})
export class ZktecoMachineModule {}
