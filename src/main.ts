// Load .env BEFORE any module is imported so process.env is available
// in Multer decorator expressions (evaluated at class-definition time)
import 'dotenv/config';

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import basicAuth = require('express-basic-auth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmetFn = require('helmet') as () => ReturnType<typeof import('helmet').default>;
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT')!;
  const corsOrigin = config.get<string>('CORS_ORIGIN')!;
  const swaggerUser = config.get<string>('SWAGGER_USER')!;
  const swaggerPassword = config.get<string>('SWAGGER_PASSWORD')!;
  const logger = new Logger('Bootstrap');

  app.use(helmetFn());

  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use(
    ['/docs', '/docs-json'],
    basicAuth({
      users: { [swaggerUser]: swaggerPassword },
      challenge: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Reduce Video Size API')
    .setDescription('Async video compression via FFmpeg (H.264/AAC)')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
