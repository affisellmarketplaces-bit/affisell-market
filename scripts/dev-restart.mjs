#!/usr/bin/env node
/** Stop live Next dev (lock PID) + free PORT, then exit so caller runs `npm run dev`. */
import { execSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"

const lockPath = join(process.cwd(), ".next/dev/lock")
const preferred = Math.max(1024, Math.min(65535, Number(process.env.PORT) || 3001))

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ESRCH") {
      return false
    }
    return true
  }
}

if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"))
    if (typeof lock.pid === "number" && pidAlive(lock.pid)) {
      process.kill(lock.pid, "SIGTERM")
      console.log(`[dev-restart] Stopped PID ${lock.pid}`)
    }
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(lockPath)
  } catch {
    /* ignore */
  }
}

for (let p = preferred; p < preferred + 5; p++) {
  try {
    const out = execSync(`lsof -ti :${p} 2>/dev/null || true`, { encoding: "utf8" }).trim()
    if (!out) continue
    for (const pid of out.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGTERM")
        console.log(`[dev-restart] Freed port ${p} (PID ${pid})`)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

spawnSync(process.execPath, [join(process.cwd(), "scripts/next-dev-port.mjs")], {
  stdio: "inherit",
  env: process.env,
})
