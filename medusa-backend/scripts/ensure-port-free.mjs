#!/usr/bin/env node
/**
 * Free Medusa dev port before start — avoids EADDRINUSE retry loop.
 */
import { execSync } from "node:child_process"
import { setTimeout } from "node:timers/promises"

const port = Number(process.argv[2] ?? 9000)
if (!Number.isFinite(port)) {
  console.error("[medusa-dev] invalid port")
  process.exit(1)
}

function getPidsOnPort(p) {
  try {
    return execSync(`lsof -ti :${p}`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number)
  } catch {
    return []
  }
}

const pids = getPidsOnPort(port)
if (pids.length === 0) {
  process.exit(0)
}

console.log(
  `[medusa-dev] Port ${port} busy (PID ${pids.join(", ")}) — stopping stale process…`,
)

for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[medusa-dev] SIGTERM ${pid} failed:`, msg)
  }
}

await setTimeout(1500)

for (const pid of getPidsOnPort(port)) {
  try {
    process.kill(pid, "SIGKILL")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[medusa-dev] SIGKILL ${pid} failed:`, msg)
  }
}

if (getPidsOnPort(port).length > 0) {
  console.error(`[medusa-dev] Could not free port ${port}`)
  process.exit(1)
}

console.log(`[medusa-dev] Port ${port} free`)
