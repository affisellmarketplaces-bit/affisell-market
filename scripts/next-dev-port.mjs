#!/usr/bin/env node
/**
 * Starts Next dev:
 * - Normal: first free TCP port in [PORT..PORT+19] (default PORT=3001) to avoid EADDRINUSE.
 * - Playwright (`PLAYWRIGHT_WEB_SERVER=1`): fixed `PORT` only (no scan) so `playwright.config` `url` matches.
 * - If a live dev server lock exists, prints its URL and exits 0 (no duplicate next dev).
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { existsSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { resolveDevPort } from "./dev-localhost-url.mjs"

const require = createRequire(import.meta.url)
const nextBin = require.resolve("next/dist/bin/next")
const lockPath = join(process.cwd(), ".next/dev/lock")

function readDevLock() {
  if (!existsSync(lockPath)) return null
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"))
    if (typeof lock.pid !== "number") return null
    return lock
  } catch {
    return null
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ESRCH") {
      return false
    }
    /* EPERM / sandbox — do not treat as stale. */
    return true
  }
}

function removeDevLock(reason) {
  if (!existsSync(lockPath)) return
  try {
    unlinkSync(lockPath)
    console.warn(`[affisell dev] Removed ${reason} .next/dev/lock\n`)
  } catch {
    /* ignore */
  }
}

/** Remove dead Next dev lock left after crash / force-quit. Returns live lock if server still running. */
function reconcileDevLock() {
  const lock = readDevLock()
  if (!lock) return null

  if (pidAlive(lock.pid)) {
    return lock
  }

  removeDevLock("stale")
  return null
}

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

async function probeNextDev(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(1500),
    })
    const powered = res.headers.get("x-powered-by") ?? ""
    return powered.toLowerCase().includes("next") || res.ok
  } catch {
    return false
  }
}

const liveLock = reconcileDevLock()
if (liveLock && process.env.PLAYWRIGHT_WEB_SERVER !== "1") {
  const url =
    typeof liveLock.appUrl === "string"
      ? liveLock.appUrl
      : `http://localhost:${liveLock.port ?? resolveDevPort()}`
  console.log(
    `\n[affisell dev] Already running → ${url}\n` +
      `  PID ${liveLock.pid} · stop with: kill ${liveLock.pid}\n` +
      `  Or restart: npm run dev:restart\n`
  )
  process.exit(0)
}

const preferred = resolveDevPort()
const scanPorts = process.env.PLAYWRIGHT_WEB_SERVER !== "1"

if (scanPorts && !(await portFree(preferred)) && (await probeNextDev(preferred))) {
  console.log(
    `\n[affisell dev] Already running → http://localhost:${preferred}\n` +
      `  Restart: npm run dev:restart\n`
  )
  process.exit(0)
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
