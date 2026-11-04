import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
import * as ffprobeStatic from 'ffprobe-static';
import * as fs from 'fs';
import {
  CompressOptions,
  PRESET_AUDIO_BITRATE,
  PRESET_CRF,
  ProbeResult,
} from './ffmpeg.types';

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor() {
    if (ffmpegStatic) {
      ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
    }
    ffmpeg.setFfprobePath(ffprobeStatic.path);
  }

  probe(filePath: string): Promise<ProbeResult> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === 'video',
        );
        if (!videoStream) {
          return reject(new Error('Nenhuma stream de vídeo encontrada'));
        }

        const stat = fs.statSync(filePath);

        resolve({
          duration: metadata.format.duration ?? 0,
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          codec: videoStream.codec_name ?? '',
          size: stat.size,
        });
      });
    });
  }

  compress(options: CompressOptions): Promise<void> {
    const { inputPath, outputPath, preset, maxWidth, onProgress } = options;
    const crf = PRESET_CRF[preset];
    const audioBitrate = PRESET_AUDIO_BITRATE[preset];

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate(audioBitrate)
        .outputOptions([
          `-crf ${crf}`,
          '-preset fast',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
        ])
        .format('mp4');

      if (maxWidth) {
        // scale down only if wider than maxWidth; keep aspect ratio; height must be even
        command = command.videoFilter(
          `scale='if(gt(iw,${maxWidth}),${maxWidth},iw)':-2`,
        );
      }

      if (onProgress) {
        command = command.on('progress', (p) => {
          const percent = Math.min(Math.round(p.percent ?? 0), 99);
          onProgress(percent);
        });
      }

      command
        .on('error', (err) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          reject(err);
        })
        .on('end', () => resolve())
        .save(outputPath);
    });
  }
}
