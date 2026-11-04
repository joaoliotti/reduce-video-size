import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FfmpegModule } from '@/modules/ffmpeg/ffmpeg.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { VIDEO_QUEUE } from './jobs.constants';
import { JobsProcessor } from './jobs.processor';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
    FfmpegModule,
    StorageModule,
  ],
  providers: [JobsRepository, JobsService, JobsProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
