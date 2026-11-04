export const VIDEO_QUEUE = 'video-compression';

export const VIDEO_COMPRESS_JOB = 'compress';

export interface CompressJobPayload {
  jobId: string;
  inputPath: string;
  outputPath: string;
  preset: 'LOW' | 'MEDIUM' | 'HIGH';
  maxWidth?: number;
  targetSizeMB?: number;
}
