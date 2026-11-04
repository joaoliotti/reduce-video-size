# reduce-video-size

API para compressão assíncrona de vídeos via FFmpeg. O upload retorna um `jobId` imediatamente e a compressão roda em background — sem travar a requisição.

## Stack

- NestJS 11 + TypeScript
- FFmpeg via `ffmpeg-static` (sem instalar nada no servidor)
- BullMQ + Redis para fila assíncrona
- Prisma + PostgreSQL para persistência dos jobs
- Multer com disk storage

## Como rodar

### Docker

```bash
cp .env.example .env
docker-compose up -d
```

### Local

Precisa de Node 24+, PostgreSQL e Redis rodando.

```bash
cp .env.example .env
# preencha o .env

npm install --legacy-peer-deps
npx prisma migrate dev --name init
npm run start:dev
```

## Documentação

Com a API rodando, acesse `/docs` para ver os endpoints via Swagger.

## Testes

```bash
npm test
```
