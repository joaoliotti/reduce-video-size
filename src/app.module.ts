import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from '@/config/env.validation';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { CronJobsModule } from '@/modules/cron-jobs/cron-jobs.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { VideosModule } from '@/modules/videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          timeout: 30 * 60 * 1000,
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 30),
          },
        ],
      }),
    }),

    ScheduleModule.forRoot(),

    PrismaModule,
    JobsModule,
    VideosModule,
    CronJobsModule,
  ],
})
export class AppModule {}
