import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  UPLOADS_DIR: Joi.string().default('uploads'),
  OUTPUT_DIR: Joi.string().default('output'),

  MAX_UPLOAD_MB: Joi.number().default(500),

  FFMPEG_CONCURRENCY: Joi.number().min(1).max(8).default(2),

  JOB_TTL_HOURS: Joi.number().default(24),

  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  SWAGGER_USER: Joi.string().default('admin'),
  SWAGGER_PASSWORD: Joi.string().default('dev-only'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(30),
}).options({ abortEarly: false });
