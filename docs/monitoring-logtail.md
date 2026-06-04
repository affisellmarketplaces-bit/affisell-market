# Better Stack (Logtail) — routes API

## Variables Vercel / `.env.local`

```env
LOGTAIL_SOURCE_TOKEN="..."   # Source token (Better Stack → Sources)
LOGTAIL_URL="https://in.logs.betterstack.com"   # Ingest host (obligatoire avec le token)
```

Sans `LOGTAIL_URL`, `@logtail/next` n’envoie **rien** au Live tail (logs console uniquement en dev).

Alias supportés : `BETTER_STACK_SOURCE_TOKEN`, `BETTER_STACK_INGESTING_URL`.

## Routes instrumentées

- `POST /api/stripe/webhook`
- `POST /api/stripe/connect/create-account`
- `POST /api/auth/signup`
- `GET|POST /api/auth/[...nextauth]`

Chaque handler appelle `await flushLogs()` avant **chaque** `return` (y compris 400).

## Test webhook

```bash
curl -sS -X POST http://localhost:3001/api/stripe/webhook \
  -H "Content-Type: application/json" -d 'break'
```

→ 400 + entrée `Webhook missing signature` dans Better Stack Live tail (si token + URL configurés).
