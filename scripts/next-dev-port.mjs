#!/usr/bin/env node
/**
 * Starts Next dev:
 * - Normal: first free TCP port in [PORT..PORT+19] (default PORT=3001) to avoid EADDRINUSE.
 * - Playwright (`PLAYWRIGHT_WEB_SERVER=1`): fixed `PORT` only (no scan) so `playwright.config` `url` matches.
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { existsSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const nextBin = require.resolve("next/dist/bin/next")

/** Remove dead Next dev lock left after crash / force-quit (avoids "Another next dev server is already running"). */
function clearStaleDevLock() {
  const lockPath = join(process.cwd(), ".next/dev/lock")
  if (!existsSync(lockPath)) return
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"))
    if (typeof lock.pid === "number") {
      try {
        process.kill(lock.pid, 0)
        return
      } catch {
        /* stale pid */
      }
    }
    unlinkSync(lockPath)
    console.warn("[affisell dev] Removed stale .next/dev/lock\n")
  } catch {
    try {
      unlinkSync(lockPath)
      console.warn("[affisell dev] Removed unreadable .next/dev/lock\n")
    } catch {
      /* ignore */
    }
  }
}

clearStaleDevLock()

const preferred = Math.max(1024, Math.min(65535, Number(process.env.PORT) || 3001))
const scanPorts = process.env.PLAYWRIGHT_WEB_SERVER !== "1"

/** Match Next.js dev bind (`::` / dual-stack) — 127.0.0.1-only checks miss EADDRINUSE. */
function portFree(port) {
  return new Promise((resolve) => {
    const s = createServer()
    const finish = (ok) => {
      try {
        s.close(() => resolve(ok))
      } catch {
        resolve(ok)
      }
    }
    s.once("error", () => finish(false))
    s.once("listening", () => finish(true))
    s.listen({ port, host: "::", ipv6Only: false })
  })
}

async function pickPort() {
  for (let p = preferred; p < preferred + 20; p++) {
    if (await portFree(p)) return p
  }
  throw new Error(`No free TCP port in range ${preferred}–${preferred + 19}`)
}

const port = scanPorts ? await pickPort() : preferred

if (scanPorts && port !== preferred) {
  console.warn(
    `\n[affisell dev] Port ${preferred} is in use → starting on ${port}.\n` +
      `  Tip: stop the other process, or set PORT=${port} in .env for stable URLs.\n`
  )
} else {
  console.log(`\n[affisell dev] http://localhost:${port}\n`)
}

const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
