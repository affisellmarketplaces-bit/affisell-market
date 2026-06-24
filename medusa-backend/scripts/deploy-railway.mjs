#!/usr/bin/env node
/**
 * Deploy medusa-backend to Railway (skip if RAILWAY_TOKEN absent).
 */
import { existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function printManualInstructions() {
  console.log(`
══════════════════════════════════════════════════
  Railway deploy — manual steps
══════════════════════════════════════════════════
1. Install CLI : npm i -g @railway/cli
2. Login       : railway login
3. New project : railway init (in medusa-backend/)
4. Link Neon   : Railway → Add PostgreSQL (Neon) → copy DATABASE_URL
5. Link Redis  : Railway → Add Upstash Redis → copy REDIS_URL
6. Env vars    : copy medusa-backend/.env.railway into Railway Variables
7. Deploy      : cd medusa-backend && railway up --detach
8. Public URL  : Railway → Settings → Generate Domain
9. Vercel      : MEDUSA_BACKEND_URL=<railway-url> ./scripts/vercel-env.sh
══════════════════════════════════════════════════
`)
}

if (!process.env.RAILWAY_TOKEN?.trim()) {
  console.log("[deploy:railway] RAILWAY_TOKEN absent — skipping deploy")
  printManualInstructions()
  process.exit(0)
}

const railway = spawnSync("railway", ["up", "--detach"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

if (railway.status !== 0) {
  console.error("[deploy:railway] railway up failed")
  process.exit(railway.status ?? 1)
}

const domain = spawnSync("railway", ["domain"], { cwd: root, encoding: "utf8", env: process.env })
const url = domain.stdout?.trim() || "(run: railway domain)"

console.log(`
✅ Railway deploy triggered
   Public URL : ${url.startsWith("http") ? url : `https://${url}`}

Next — wire Vercel:
  MEDUSA_BACKEND_URL=${url.startsWith("http") ? url : `https://${url}`} \\
  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<pk from setup:auto> \\
  ./scripts/vercel-env.sh
`)
