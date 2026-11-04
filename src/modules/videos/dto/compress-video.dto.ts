import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum PresetEnum {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CompressVideoDto {
  @ApiPropertyOptional({
    enum: PresetEnum,
    default: PresetEnum.MEDIUM,
    description: 'Compression preset. high=CRF23, medium=CRF28, low=CRF32',
  })
  @IsOptional()
  @IsEnum(PresetEnum, { message: 'preset deve ser low, medium ou high' })
  preset?: PresetEnum = PresetEnum.MEDIUM;

  @ApiPropertyOptional({
    example: 1280,
    description:
      'Maximum output width in pixels. Aspect ratio is preserved. Video is never upscaled.',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber({}, { message: 'maxWidth deve ser um número' })
  @Min(64, { message: 'maxWidth mínimo é 64px' })
  @Max(7680, { message: 'maxWidth máximo é 7680px (8K)' })
  maxWidth?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Target output size in MB (best-effort, not guaranteed)',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber({}, { message: 'targetSizeMB deve ser um número' })
  @Min(1, { message: 'targetSizeMB mínimo é 1' })
  targetSizeMB?: number;
}
