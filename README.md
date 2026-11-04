# reduce-video-size

API para compressão assíncrona de vídeos. Você faz o upload, recebe um `jobId` na hora e a compressão acontece em background via FFmpeg. Quando terminar, é só baixar.

---

## Por que esse projeto existe?

Comprimir vídeo no browser é lento e limitado. Comprimir no servidor de forma síncrona trava a requisição por minutos. Essa API resolve os dois problemas: o upload retorna imediatamente, a compressão roda em background com uma fila (BullMQ + Redis), e você acompanha o progresso por polling.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript strict |
| Compressão | FFmpeg via `fluent-ffmpeg` + `ffmpeg-static` |
| Fila | BullMQ + Redis |
| Banco | Prisma + PostgreSQL |
| Upload | Multer disk storage (nunca carrega o vídeo inteiro em memória) |

> `ffmpeg-static` e `ffprobe-static` embarcam os binários do FFmpeg no `node_modules` — não precisa instalar nada no servidor manualmente.

---

## Como rodar

### Com Docker (recomendado)

Sobe tudo (API + PostgreSQL + Redis) com um comando:

```bash
cp .env.example .env
# edite o .env se necessário
docker-compose up -d
```

API disponível em `http://localhost:3000`.

---

### Local (Node + Postgres + Redis já instalados)

```bash
cp .env.example .env
# edite o .env com sua DATABASE_URL, REDIS_HOST etc.

npm install --legacy-peer-deps

npx prisma migrate dev --name init

npm run start:dev
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. Todas as variáveis são obrigatórias — a aplicação não sobe se alguma estiver faltando.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Conexão com Redis |
| `UPLOADS_DIR` / `OUTPUT_DIR` | Pastas de upload e saída (relativas à raiz do projeto) |
| `MAX_UPLOAD_MB` | Limite de tamanho de upload em MB |
| `FFMPEG_CONCURRENCY` | Número máximo de processos FFmpeg simultâneos |
| `JOB_TTL_HOURS` | Horas até um job expirar e os arquivos serem apagados automaticamente |
| `CORS_ORIGIN` | Origens permitidas no CORS (separadas por vírgula) |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | Credenciais de acesso ao Swagger |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limit: `LIMIT` requisições a cada `TTL` segundos |

---

## Endpoints

### `POST /videos/compress`

Faz upload do vídeo e enfileira a compressão. Retorna na hora com o `jobId`.

```bash
# Linux/macOS
curl -X POST http://localhost:3000/videos/compress \
  -F "file=@/caminho/video.mp4" \
  -F "preset=medium"

# Windows (PowerShell)
curl.exe -s -X POST http://localhost:3000/videos/compress `
  -F "file=@C:\caminho\video.mp4" `
  -F "preset=medium"
```

Campos opcionais do form:
- `preset`: `low` | `medium` | `high` — quanto menor, menor o arquivo (e menor a qualidade)
- `maxWidth`: largura máxima em pixels — mantém proporção, nunca amplia
- `targetSizeMB`: tamanho alvo em MB (melhor esforço, sem garantia)

Resposta `202 Accepted`:
```json
{ "jobId": "uuid", "status": "queued" }
```

---

### `GET /videos/:id`

Consulta o status e progresso do job.

```bash
curl http://localhost:3000/videos/SEU_JOB_ID
```

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

**Valores de `status`:** `queued` → `processing` → `done` | `failed`

> Se o arquivo comprimido ficar maior que o original, `usedOriginal: true` e o original é devolvido no download.

---

### `GET /videos/:id/download`

Faz o stream do arquivo comprimido. Só funciona quando `status === "done"`.

```bash
# Salva com o nome original
curl -OJ http://localhost:3000/videos/SEU_JOB_ID/download
```

---

### `DELETE /videos/:id`

Remove o job e os arquivos do disco.

```bash
curl -X DELETE http://localhost:3000/videos/SEU_JOB_ID
```

Resposta: `204 No Content`

---

## Presets de compressão

| Preset | CRF | Áudio | Uso indicado |
|---|---|---|---|
| `high` | 23 | 128 kbps | Máxima qualidade, menor redução de tamanho |
| `medium` | 28 | 128 kbps | Equilíbrio entre qualidade e tamanho |
| `low` | 32 | 96 kbps | Máxima redução, qualidade menor |

Saída sempre em H.264 + AAC, container MP4, com `-movflags +faststart` (otimizado para streaming web).

---

## Swagger

Disponível em `http://localhost:3000/docs` com autenticação básica (configurada via `SWAGGER_USER` e `SWAGGER_PASSWORD` no `.env`).

Tem também um `postman-collection.json` na raiz — importe no Postman para testar todos os endpoints com o `jobId` preenchido automaticamente após o upload.

---

## Testes

```bash
npm test
npm run test:cov  # com cobertura
```

---

## Estrutura do projeto

```
src/
├── config/              # Validação de env com Joi
├── common/
│   ├── prisma/          # PrismaService global
│   └── filters/         # HttpExceptionFilter
└── modules/
    ├── videos/          # Controller, Service e DTOs
    ├── jobs/            # Processor BullMQ + repository
    ├── ffmpeg/          # Wrapper do fluent-ffmpeg
    ├── storage/         # Gerenciamento de caminhos de arquivo
    └── cron-jobs/       # Limpeza automática de jobs expirados
```
