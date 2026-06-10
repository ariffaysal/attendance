import { Module } from '@nestjs/common';
import { SetupDataController } from './setup-data.controller';
import { SetupDataService } from './setup-data.service';

@Module({
  controllers: [SetupDataController],
  providers: [SetupDataService],
  exports: [SetupDataService],
})
export class SetupDataModule {}
