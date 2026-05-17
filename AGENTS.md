## Git push

- Never put real API keys in `.env.example` — use empty placeholders only (`GROQ_API_KEY=""`).
- Before pushing: `npm run push:safe` (secret scan + pull --rebase + push).
- Optional hook (once per clone): `git config core.hooksPath .githooks` then `chmod +x .githooks/pre-push`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
