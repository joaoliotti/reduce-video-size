import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [JobsModule, StorageModule],
  providers: [CleanupService],
})
export class CronJobsModule {}
