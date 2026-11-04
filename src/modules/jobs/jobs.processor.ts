import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { FfmpegService } from '@/modules/ffmpeg/ffmpeg.service';
import { StorageService } from '@/modules/storage/storage.service';
import {
  CompressJobPayload,
  VIDEO_COMPRESS_JOB,
  VIDEO_QUEUE,
} from './jobs.constants';
import { JobsService } from './jobs.service';

@Processor(VIDEO_QUEUE, {
  concurrency: parseInt(process.env['FFMPEG_CONCURRENCY']!, 10),
})
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly ffmpegService: FfmpegService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  @OnWorkerEvent('ready')
  onReady() {
    this.logger.log('Worker connected to Redis and ready');
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Worker error: ${err.message}`, err.stack);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error(`Job ${job?.id ?? '?'} failed: ${err.message}`);
  }

  async process(job: Job<CompressJobPayload>): Promise<void> {
    if (job.name !== VIDEO_COMPRESS_JOB) return;

    const { jobId, inputPath, outputPath, preset, maxWidth } = job.data;

    this.logger.log(`Processing job ${jobId} [preset=${preset}]`);

    await this.jobsService.update(jobId, {
      status: 'PROCESSING',
      progress: 0,
    });

    try {
      await this.ffmpegService.compress({
        inputPath,
        outputPath,
        preset,
        maxWidth,
        onProgress: async (percent) => {
          await this.jobsService.update(jobId, { progress: percent });
        },
      });

      const originalStat = fs.statSync(inputPath);
      const compressedStat = fs.statSync(outputPath);

      const originalSize = BigInt(originalStat.size);
      const compressedSize = BigInt(compressedStat.size);

      if (compressedSize >= originalSize) {
        await this.jobsService.update(jobId, {
          status: 'DONE',
          progress: 100,
          compressedSize: originalSize,
          outputPath: inputPath,
          usedOriginal: true,
          finishedAt: new Date(),
        });
        await this.storageService.deleteFiles(outputPath);
        this.logger.log(`Job ${jobId}: compressed >= original, keeping original`);
      } else {
        await this.jobsService.update(jobId, {
          status: 'DONE',
          progress: 100,
          compressedSize,
          outputPath,
          usedOriginal: false,
          finishedAt: new Date(),
        });
        this.logger.log(`Job ${jobId}: done. ${originalSize} → ${compressedSize} bytes`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${message}`);

      await this.jobsService.update(jobId, {
        status: 'FAILED',
        error: message,
        finishedAt: new Date(),
      });

      await this.storageService.deleteFiles(outputPath);
      throw err;
    }
  }
}
