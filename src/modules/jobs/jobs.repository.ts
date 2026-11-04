import { Injectable } from '@nestjs/common';
import { Prisma, VideoJob } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VideoJobCreateInput): Promise<VideoJob> {
    return this.prisma.videoJob.create({ data });
  }

  findById(id: string): Promise<VideoJob | null> {
    return this.prisma.videoJob.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.VideoJobUpdateInput): Promise<VideoJob> {
    return this.prisma.videoJob.update({ where: { id }, data });
  }

  delete(id: string): Promise<VideoJob> {
    return this.prisma.videoJob.delete({ where: { id } });
  }

  findExpired(): Promise<VideoJob[]> {
    return this.prisma.videoJob.findMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
}
