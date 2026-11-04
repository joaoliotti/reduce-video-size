import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { FfmpegService } from '@/modules/ffmpeg/ffmpeg.service';
import { StorageService } from '@/modules/storage/storage.service';
import {
  CompressJobPayload,
  VIDEO_COMPRESS_JOB,
  VIDEO_QUEUE,
} from '@/modules/jobs/jobs.constants';
import { JobsService } from '@/modules/jobs/jobs.service';
import { CompressVideoDto, PresetEnum } from './dto/compress-video.dto';
import { JobStatusResponseDto } from './dto/job-status-response.dto';
import { VideoJob } from '@prisma/client';

// Allowed extensions — mimetype is NOT checked here because curl/Windows
// often sends application/octet-stream regardless of the actual format.
// ffprobe is the real validator (runs below).
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectQueue(VIDEO_QUEUE) private readonly videoQueue: Queue,
    private readonly jobsService: JobsService,
    private readonly ffmpegService: FfmpegService,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  async compress(
    file: Express.Multer.File,
    dto: CompressVideoDto,
  ): Promise<{ jobId: string; status: string }> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      await this.storageService.deleteFiles(file.path);
      throw new BadRequestException(
        `Extensão não suportada: ${ext || '(nenhuma)'}. Aceitos: mp4, mov, mkv, webm, avi`,
      );
    }

    // ffprobe is the authoritative validator — rejects corrupt/non-video files
    try {
      await this.ffmpegService.probe(file.path);
    } catch {
      await this.storageService.deleteFiles(file.path);
      throw new BadRequestException(
        'Arquivo inválido ou corrompido (ffprobe falhou)',
      );
    }

    const preset = (dto.preset ?? PresetEnum.MEDIUM).toUpperCase() as
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH';

    const ttlHours = this.config.get<number>('JOB_TTL_HOURS')!;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const stat = fs.statSync(file.path);

    const job = await this.jobsService.create({
      originalName: file.originalname,
      originalSize: BigInt(stat.size),
      preset,
      maxWidth: dto.maxWidth ?? null,
      targetSizeMB: dto.targetSizeMB ?? null,
      inputPath: file.path,
      outputPath: null,
      expiresAt,
    });

    const outputPath = this.storageService.genOutputPath(job.id);

    await this.jobsService.update(job.id, { outputPath });

    const payload: CompressJobPayload = {
      jobId: job.id,
      inputPath: file.path,
      outputPath,
      preset,
      maxWidth: dto.maxWidth,
      targetSizeMB: dto.targetSizeMB,
    };

    await this.videoQueue.add(VIDEO_COMPRESS_JOB, payload, {
      jobId: job.id,
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`Enqueued job ${job.id} [${preset}]`);

    return { jobId: job.id, status: 'queued' };
  }

  async getStatus(id: string): Promise<JobStatusResponseDto> {
    const job = await this.jobsService.findByIdOrThrow(id);
    return this.toResponseDto(job);
  }

  async getDownloadInfo(
    id: string,
  ): Promise<{ filePath: string; filename: string; mimeType: string }> {
    const job = await this.jobsService.findByIdOrThrow(id);

    if (job.status !== 'DONE') {
      throw new BadRequestException(
        `Job não está pronto. Status atual: ${job.status.toLowerCase()}`,
      );
    }

    const filePath = job.outputPath ?? job.inputPath;

    if (!this.storageService.fileExists(filePath)) {
      throw new NotFoundException('Arquivo não encontrado no disco');
    }

    const baseName = path.basename(job.originalName, path.extname(job.originalName));
    const filename = `${baseName}_compressed.mp4`;

    return { filePath, filename, mimeType: 'video/mp4' };
  }

  async deleteJob(id: string): Promise<void> {
    const job = await this.jobsService.findByIdOrThrow(id);

    await this.storageService.deleteFiles(job.inputPath, job.outputPath);

    // Remove from BullMQ queue if still queued
    try {
      const bullJob = await this.videoQueue.getJob(id);
      if (bullJob) await bullJob.remove();
    } catch {
      // already processed — no-op
    }

    await this.jobsService.delete(id);
  }

  private toResponseDto(job: VideoJob): JobStatusResponseDto {
    const originalSize = Number(job.originalSize);
    const compressedSize = job.compressedSize ? Number(job.compressedSize) : null;

    const reductionPercent =
      compressedSize !== null && originalSize > 0
        ? Math.round((1 - compressedSize / originalSize) * 100)
        : null;

    return {
      id: job.id,
      status: job.status.toLowerCase(),
      progress: job.progress,
      originalName: job.originalName,
      originalSize,
      compressedSize,
      reductionPercent,
      preset: job.preset.toLowerCase(),
      usedOriginal: job.usedOriginal,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      expiresAt: job.expiresAt,
    };
  }
}
