#!/usr/bin/env node
/**
 * Kill stale Medusa develop watchers + free dev port.
 */
import { spawnSync, execSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout } from "node:timers/promises"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MARKER = "affisell-market/medusa-backend"
const DEFAULT_PORT = 9000

function isAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getPidsMatching(pattern) {
  try {
    const out = execSync(`pgrep -fl '${pattern}'`, { encoding: "utf8" })
    return out
      .trim()
      .split("\n")
      .filter((line) => line.includes(MARKER))
      .map((line) => Number(line.trim().split(/\s+/)[0]))
      .filter((pid) => Number.isFinite(pid))
  } catch {
    return []
  }
}

async function killPids(pids, label) {
  const unique = [...new Set(pids)].filter((pid) => pid !== process.pid)
  if (unique.length === 0) return
  console.log(`[medusa-dev] ${label}: PID ${unique.join(", ")}`)
  for (const pid of unique) {
    try {
      process.kill(pid, "SIGTERM")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[medusa-dev] SIGTERM ${pid} failed:`, msg)
    }
  }
  await setTimeout(1500)
  for (const pid of unique) {
    if (isAlive(pid)) {
      try {
        process.kill(pid, "SIGKILL")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[medusa-dev] SIGKILL ${pid} failed:`, msg)
      }
    }
  }
}

export async function cleanupMedusaDev(port = DEFAULT_PORT) {
  const stale = [
    ...getPidsMatching("medusa develop"),
    ...getPidsMatching("with-env.mjs develop"),
    ...getPidsMatching("scripts/dev.mjs"),
  ]
  await killPids(stale, "Stopping stale Medusa dev")

  const portResult = spawnSync("node", ["scripts/ensure-port-free.mjs", String(port)], {
    cwd: root,
    stdio: "inherit",
  })
  return portResult.status === 0
}

const isMain = process.argv[1]?.endsWith("dev-cleanup.mjs")
if (isMain) {
  const port = Number(process.argv[2] ?? DEFAULT_PORT)
  const ok = await cleanupMedusaDev(port)
  process.exit(ok ? 0 : 1)
}
