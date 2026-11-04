export interface CompressOptions {
  inputPath: string;
  outputPath: string;
  preset: 'LOW' | 'MEDIUM' | 'HIGH';
  maxWidth?: number;
  onProgress?: (percent: number) => void;
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  codec: string;
  size: number;
}

export const PRESET_CRF: Record<string, number> = {
  HIGH: 23,
  MEDIUM: 28,
  LOW: 32,
};

export const PRESET_AUDIO_BITRATE: Record<string, string> = {
  HIGH: '128k',
  MEDIUM: '128k',
  LOW: '96k',
};
