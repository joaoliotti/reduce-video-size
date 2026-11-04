import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobStatusResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ enum: ['queued', 'processing', 'done', 'failed'] })
  status: string;

  @ApiProperty({ example: 75, description: 'Progress 0-100' })
  progress: number;

  @ApiProperty({ example: 'video.mp4' })
  originalName: string;

  @ApiProperty({ example: 104857600, description: 'Original size in bytes' })
  originalSize: number;

  @ApiPropertyOptional({
    example: 52428800,
    description: 'Compressed size in bytes (null until done)',
  })
  compressedSize: number | null;

  @ApiPropertyOptional({
    example: 50,
    description: 'Percentage size reduction (null until done)',
  })
  reductionPercent: number | null;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  preset: string;

  @ApiProperty({ example: false, description: 'True if compressed was larger than original' })
  usedOriginal: boolean;

  @ApiPropertyOptional({ example: null, description: 'Error message if status=failed' })
  error: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  finishedAt: Date | null;

  @ApiPropertyOptional()
  expiresAt: Date;
}

export class CompressResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  jobId: string;

  @ApiProperty({ enum: ['queued'] })
  status: string;
}
