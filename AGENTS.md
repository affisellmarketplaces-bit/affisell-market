## Git push

- Never put real API keys in `.env.example` — use empty placeholders only (`GROQ_API_KEY=""`).
- Before pushing: `npm run push:safe` → `node scripts/git-push-safe.mjs` (secret scan, `git fetch` / `pull --rebase` / `push` with **timeouts**, no interactive Git prompts).
- Optional hook (once per clone): `git config core.hooksPath .githooks` then `chmod +x .githooks/pre-push`.

### Pourquoi les pushs « s’interrompent » dans Cursor

Ce n’est pas un échec du commit : c’est souvent **`git pull --rebase` qui attend le réseau** (ou un prompt Git) dans une seule commande `commit && push:safe`. L’agent doit faire **deux appels shell** : d’abord `git commit`, puis `npm run push:safe` seul.

### Agent : commit + push après une correction

1. `git commit` (commande shell 1)
2. `npm run push:safe` (commande shell 2, séparée)

Puis une ligne : **Git** — Commit `abc1234` — *message* — push OK (`main`). Détail : `.cursor/rules/git-commit-after-fix.mdc`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
