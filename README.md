# reduce-video-size

Async video compression API built with NestJS + FFmpeg. Upload a video, get a `jobId` back immediately, poll for status, download the compressed file.

## Stack

- **NestJS 11** (TypeScript strict)
- **FFmpeg** via `fluent-ffmpeg` + `ffmpeg-static` / `ffprobe-static` (no host install needed)
- **BullMQ + Redis** for async job queue
- **Prisma + PostgreSQL** for job persistence
- **Multer disk storage** (never loads full video in memory)

---

## Quickstart with Docker

```bash
cp .env.example .env
docker-compose up -d
```

The API will be available at `http://localhost:3000`.

---

## Local development

**Prerequisites:** Node 24+, PostgreSQL, Redis

```bash
cp .env.example .env
# Edit .env with your DB and Redis credentials

npm install --legacy-peer-deps

npx prisma migrate dev --name init
npx prisma generate

npm run start:dev
```

---

## Environment variables

See `.env.example` for all variables. Key ones:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `MAX_UPLOAD_MB` | `500` | Upload size limit |
| `FFMPEG_CONCURRENCY` | `2` | Max parallel FFmpeg processes |
| `JOB_TTL_HOURS` | `24` | Hours before job/files are auto-deleted |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | `admin` / `dev-only` | Swagger basic auth |

---

## Endpoints

### POST `/videos/compress`

Upload a video for async compression.

```bash
curl -X POST http://localhost:3000/videos/compress \
  -F "file=@/path/to/video.mp4" \
  -F "preset=medium"
```

Optional form fields:
- `preset`: `low` | `medium` | `high` (default: `medium`)
- `maxWidth`: integer — max output width in pixels (preserves aspect ratio, never upscales)
- `targetSizeMB`: number — best-effort target output size

Response `202 Accepted`:
```json
{ "jobId": "uuid", "status": "queued" }
```

---

### GET `/videos/:id`

Poll job status.

```bash
curl http://localhost:3000/videos/YOUR_JOB_ID
```

Response:
```json
{
  "id": "uuid",
  "status": "done",
  "progress": 100,
  "originalName": "video.mp4",
  "originalSize": 104857600,
  "compressedSize": 52428800,
  "reductionPercent": 50,
  "preset": "medium",
  "usedOriginal": false,
  "error": null,
  "createdAt": "2026-11-04T12:00:00.000Z",
  "finishedAt": "2026-11-04T12:00:30.000Z",
  "expiresAt": "2026-11-05T12:00:00.000Z"
}
```

**status values:** `queued` | `processing` | `done` | `failed`

> `usedOriginal: true` means the compressed file was larger than the original — the original is returned as-is.

---

### GET `/videos/:id/download`

Stream the compressed (or original) video file.

```bash
# Save to file
curl -OJ http://localhost:3000/videos/YOUR_JOB_ID/download

# With wget
wget --content-disposition http://localhost:3000/videos/YOUR_JOB_ID/download
```

Only available when `status === "done"`.

---

### DELETE `/videos/:id`

Delete a job and its associated files.

```bash
curl -X DELETE http://localhost:3000/videos/YOUR_JOB_ID
```

Response: `204 No Content`

---

## Compression presets

| Preset | CRF | Audio |
|---|---|---|
| `high` | 23 | 128 kbps |
| `medium` | 28 | 128 kbps |
| `low` | 32 | 96 kbps |

Output is always H.264 + AAC in an MP4 container with `-movflags +faststart` (web-optimized).

---

## Swagger

Available at `http://localhost:3000/docs` (protected with basic auth — `SWAGGER_USER` / `SWAGGER_PASSWORD`).

---

## Running tests

```bash
npm test
npm run test:cov   # with coverage
```

---

## Project structure

```
src/
├── config/            # Joi env validation
├── common/
│   ├── prisma/        # Global PrismaService
│   └── filters/       # HttpExceptionFilter
└── modules/
    ├── videos/        # Controller + Service + DTOs
    ├── jobs/          # BullMQ processor + repository
    ├── ffmpeg/        # fluent-ffmpeg wrapper
    ├── storage/       # File path management
    └── cron-jobs/     # Hourly cleanup of expired jobs
```
