#!/usr/bin/env node
/**
 * Single-instance Medusa develop — kills stale watchers + frees port 9000 before start.
 */
import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { cleanupMedusaDev } from "./dev-cleanup.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const LOCK = resolve(root, ".medusa-dev.lock")
const PORT = 9000

function isAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function clearLock() {
  try {
    unlinkSync(LOCK)
  } catch {
    /* already removed */
  }
}

function readLock() {
  if (!existsSync(LOCK)) return null
  try {
    const raw = readFileSync(LOCK, "utf8").trim()
    const parsed = JSON.parse(raw)
    return typeof parsed.pid === "number" ? parsed : { pid: Number(raw) }
  } catch {
    return null
  }
}

function assertSingleton() {
  const lock = readLock()
  if (!lock?.pid) return
  if (isAlive(lock.pid)) {
    console.error(
      `[medusa-dev] Déjà en cours (PID ${lock.pid}). Ctrl+C dans l'autre terminal ou: npm run dev:stop`,
    )
    process.exit(1)
  }
  clearLock()
}

assertSingleton()

const cleaned = await cleanupMedusaDev(PORT)
if (!cleaned) {
  process.exit(1)
}

writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))

function shutdown() {
  clearLock()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
process.on("exit", shutdown)

const child = spawn("node", ["scripts/with-env.mjs", "develop"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => {
  shutdown()
  process.exit(code ?? 1)
})
