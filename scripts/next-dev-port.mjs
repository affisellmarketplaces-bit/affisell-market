#!/usr/bin/env node
/**
 * Starts Next dev:
 * - Normal: first free TCP port in [PORT..PORT+19] (default PORT=3001) to avoid EADDRINUSE.
 * - Playwright (`PLAYWRIGHT_WEB_SERVER=1`): fixed `PORT` only (no scan) so `playwright.config` `url` matches.
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { createServer } from "node:net"

const require = createRequire(import.meta.url)
const nextBin = require.resolve("next/dist/bin/next")

const preferred = Math.max(1024, Math.min(65535, Number(process.env.PORT) || 3001))
const scanPorts = process.env.PLAYWRIGHT_WEB_SERVER !== "1"

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
    s.listen({ port, host: "127.0.0.1", ipv6Only: false })
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
