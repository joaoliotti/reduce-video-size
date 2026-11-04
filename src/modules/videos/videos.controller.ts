import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CompressVideoDto } from './dto/compress-video.dto';
import {
  CompressResponseDto,
  JobStatusResponseDto,
} from './dto/job-status-response.dto';
import { VideosService } from './videos.service';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly config: ConfigService,
  ) {}

  @Post('compress')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upload a video for async compression' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        preset: { type: 'string', enum: ['low', 'medium', 'high'] },
        maxWidth: { type: 'number' },
        targetSizeMB: { type: 'number' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 202, type: CompressResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const config: ConfigService = req.app.get(ConfigService);
          const uploadsDir = path.resolve(
            process.cwd(),
            config.get<string>('UPLOADS_DIR', 'uploads'),
          );
          cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: {
        fileSize: parseInt(process.env['MAX_UPLOAD_MB'] ?? '500') * 1024 * 1024,
      },
    }),
  )
  async compress(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CompressVideoDto,
  ): Promise<CompressResponseDto> {
    return this.videosService.compress(file, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job status and compression info' })
  @ApiParam({ name: 'id', description: 'Job ID returned by /compress' })
  @ApiResponse({ status: 200, type: JobStatusResponseDto })
  async getStatus(@Param('id') id: string): Promise<JobStatusResponseDto> {
    return this.videosService.getStatus(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Stream the compressed video file' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Video file stream' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filePath, filename, mimeType } =
      await this.videosService.getDownloadInfo(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.sendFile(filePath);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job and its files' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 204 })
  async deleteJob(@Param('id') id: string): Promise<void> {
    return this.videosService.deleteJob(id);
  }
}
