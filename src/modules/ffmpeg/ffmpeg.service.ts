import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require('ffmpeg-static') as string | null;
import {
  CompressOptions,
  PRESET_AUDIO_BITRATE,
  PRESET_CRF,
  ProbeResult,
} from './ffmpeg.types';

// ffprobe-static has no @types — inline declaration
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffprobePath: string = require('ffprobe-static').path as string;

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor() {
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    ffmpeg.setFfprobePath(ffprobePath);
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
        command = command.videoFilter(
          `scale='if(gt(iw,${maxWidth}),${maxWidth},iw)':-2`,
        );
      }

      if (onProgress) {
        command = command.on(
          'progress',
          (p: { percent?: number }) => {
            const percent = Math.min(Math.round(p.percent ?? 0), 99);
            onProgress(percent);
          },
        );
      }

      command
        .on('error', (err: Error) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          reject(err);
        })
        .on('end', () => resolve())
        .save(outputPath);
    });
  }
}
