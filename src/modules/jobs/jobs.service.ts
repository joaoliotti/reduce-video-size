import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VideoJob } from '@prisma/client';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
  constructor(private readonly repo: JobsRepository) {}

  create(data: Prisma.VideoJobCreateInput): Promise<VideoJob> {
    return this.repo.create(data);
  }

  async findByIdOrThrow(id: string): Promise<VideoJob> {
    const job = await this.repo.findById(id);
    if (!job) throw new NotFoundException(`Job ${id} não encontrado`);
    return job;
  }

  update(id: string, data: Prisma.VideoJobUpdateInput): Promise<VideoJob> {
    return this.repo.update(id, data);
  }

  delete(id: string): Promise<VideoJob> {
    return this.repo.delete(id);
  }

  findExpired(): Promise<VideoJob[]> {
    return this.repo.findExpired();
  }
}
