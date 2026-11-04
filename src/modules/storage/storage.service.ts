import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly uploadsDir: string;
  private readonly outputDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadsDir = path.resolve(
      process.cwd(),
      config.get<string>('UPLOADS_DIR', 'uploads'),
    );
    this.outputDir = path.resolve(
      process.cwd(),
      config.get<string>('OUTPUT_DIR', 'output'),
    );
    this.ensureDirs();
  }

  private ensureDirs() {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  genInputPath(ext: string): string {
    return path.join(this.uploadsDir, `${uuidv4()}${ext}`);
  }

  genOutputPath(jobId: string): string {
    return path.join(this.outputDir, `${jobId}.mp4`);
  }

  async deleteFiles(...filePaths: (string | null | undefined)[]) {
    for (const filePath of filePaths) {
      if (!filePath) continue;
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // file already gone — no-op
      }
    }
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  getUploadsDir(): string {
    return this.uploadsDir;
  }

  getOutputDir(): string {
    return this.outputDir;
  }
}
