import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from '@/modules/jobs/jobs.service';
import { StorageService } from '@/modules/storage/storage.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanExpiredJobs() {
    this.logger.log('Running expired jobs cleanup...');

    const expiredJobs = await this.jobsService.findExpired();

    if (expiredJobs.length === 0) {
      this.logger.log('No expired jobs found');
      return;
    }

    let deleted = 0;
    for (const job of expiredJobs) {
      try {
        await this.storageService.deleteFiles(job.inputPath, job.outputPath);
        await this.jobsService.delete(job.id);
        deleted++;
      } catch (err) {
        this.logger.error(
          `Failed to cleanup job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(`Cleaned up ${deleted}/${expiredJobs.length} expired jobs`);
  }
}
