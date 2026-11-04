import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FfmpegModule } from '@/modules/ffmpeg/ffmpeg.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { VIDEO_QUEUE } from '@/modules/jobs/jobs.constants';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
    JobsModule,
    FfmpegModule,
    StorageModule,
  ],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
