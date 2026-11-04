jest.mock('fluent-ffmpeg');
jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg');
jest.mock('ffprobe-static', () => ({ path: '/usr/bin/ffprobe' }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: jest.fn(),
}));

import ffmpeg = require('fluent-ffmpeg');
import * as fs from 'fs';
import { FfmpegService } from './ffmpeg.service';

const mockFfmpegModule = ffmpeg as unknown as jest.Mock & {
  setFfmpegPath: jest.Mock;
  setFfprobePath: jest.Mock;
  ffprobe: jest.Mock;
};

const mockCommand = {
  videoCodec: jest.fn().mockReturnThis(),
  audioCodec: jest.fn().mockReturnThis(),
  audioBitrate: jest.fn().mockReturnThis(),
  outputOptions: jest.fn().mockReturnThis(),
  format: jest.fn().mockReturnThis(),
  videoFilter: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  save: jest.fn().mockReturnThis(),
};

describe('FfmpegService', () => {
  let service: FfmpegService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFfmpegModule.mockReturnValue(mockCommand);
    mockFfmpegModule.setFfmpegPath = jest.fn();
    mockFfmpegModule.setFfprobePath = jest.fn();
    mockFfmpegModule.ffprobe = jest.fn();

    (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 } as fs.Stats);

    service = new FfmpegService();
  });

  describe('probe()', () => {
    it('resolves with video metadata', async () => {
      mockFfmpegModule.ffprobe.mockImplementation(
        (_path: string, cb: (err: null, meta: object) => void) =>
          cb(null, {
            format: { duration: 10 },
            streams: [
              { codec_type: 'video', width: 1920, height: 1080, codec_name: 'h264' },
            ],
          }),
      );

      const result = await service.probe('/tmp/test.mp4');

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.codec).toBe('h264');
      expect(result.duration).toBe(10);
    });

    it('rejects when no video stream found', async () => {
      mockFfmpegModule.ffprobe.mockImplementation(
        (_path: string, cb: (err: null, meta: object) => void) =>
          cb(null, { format: { duration: 0 }, streams: [{ codec_type: 'audio' }] }),
      );

      await expect(service.probe('/tmp/audio.mp3')).rejects.toThrow(
        'Nenhuma stream de vídeo encontrada',
      );
    });

    it('rejects on ffprobe error', async () => {
      mockFfmpegModule.ffprobe.mockImplementation(
        (_path: string, cb: (err: Error) => void) =>
          cb(new Error('ffprobe failed')),
      );

      await expect(service.probe('/tmp/bad.mp4')).rejects.toThrow('ffprobe failed');
    });
  });

  describe('compress()', () => {
    function setupEndTrigger() {
      mockCommand.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'end') setImmediate(cb);
        return mockCommand;
      });
    }

    it('calls ffmpeg with correct codec options for MEDIUM preset', async () => {
      setupEndTrigger();

      await service.compress({
        inputPath: '/tmp/input.mp4',
        outputPath: '/tmp/output.mp4',
        preset: 'MEDIUM',
      });

      expect(mockFfmpegModule).toHaveBeenCalledWith('/tmp/input.mp4');
      expect(mockCommand.videoCodec).toHaveBeenCalledWith('libx264');
      expect(mockCommand.audioCodec).toHaveBeenCalledWith('aac');
      expect(mockCommand.audioBitrate).toHaveBeenCalledWith('128k');
      expect(mockCommand.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining(['-crf 28', '-movflags +faststart']),
      );
      expect(mockCommand.save).toHaveBeenCalledWith('/tmp/output.mp4');
    });

    it.each([
      ['HIGH', 23],
      ['MEDIUM', 28],
      ['LOW', 32],
    ] as ['HIGH' | 'MEDIUM' | 'LOW', number][])(
      'preset %s uses CRF %d',
      async (preset, crf) => {
        setupEndTrigger();

        await service.compress({
          inputPath: '/tmp/in.mp4',
          outputPath: '/tmp/out.mp4',
          preset,
        });

        expect(mockCommand.outputOptions).toHaveBeenCalledWith(
          expect.arrayContaining([`-crf ${crf}`]),
        );
      },
    );

    it('applies scale filter when maxWidth is set', async () => {
      setupEndTrigger();

      await service.compress({
        inputPath: '/tmp/input.mp4',
        outputPath: '/tmp/output.mp4',
        preset: 'MEDIUM',
        maxWidth: 1280,
      });

      expect(mockCommand.videoFilter).toHaveBeenCalledWith(
        expect.stringContaining('1280'),
      );
    });

    it('does not apply scale filter when maxWidth is omitted', async () => {
      setupEndTrigger();

      await service.compress({
        inputPath: '/tmp/input.mp4',
        outputPath: '/tmp/output.mp4',
        preset: 'HIGH',
      });

      expect(mockCommand.videoFilter).not.toHaveBeenCalled();
    });

    it('reports progress via onProgress callback (capped at 99)', async () => {
      const onProgress = jest.fn();
      let progressCb: ((p: { percent?: number }) => void) | undefined;

      mockCommand.on.mockImplementation(
        (event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'progress') progressCb = cb as (p: { percent?: number }) => void;
          if (event === 'end') setImmediate(cb as () => void);
          return mockCommand;
        },
      );

      const p = service.compress({
        inputPath: '/tmp/in.mp4',
        outputPath: '/tmp/out.mp4',
        preset: 'MEDIUM',
        onProgress,
      });

      progressCb?.({ percent: 50 });
      progressCb?.({ percent: 101 });

      await p;

      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(99);
    });

    it('rejects when ffmpeg emits error', async () => {
      mockCommand.on.mockImplementation(
        (event: string, cb: (err?: Error) => void) => {
          if (event === 'error') setImmediate(() => cb(new Error('encode failed')));
          return mockCommand;
        },
      );

      await expect(
        service.compress({
          inputPath: '/tmp/in.mp4',
          outputPath: '/tmp/out.mp4',
          preset: 'LOW',
        }),
      ).rejects.toThrow('encode failed');
    });
  });
});
