import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { RuleEngineService } from './rule-engine.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LibraryController],
  providers: [LibraryService, RuleEngineService],
  exports: [LibraryService, RuleEngineService],
})
export class LibraryModule {}
