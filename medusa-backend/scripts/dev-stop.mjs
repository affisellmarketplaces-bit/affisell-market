#!/usr/bin/env node
/**
 * Stop all local Medusa develop processes + free port 9000.
 */
import { existsSync, unlinkSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { cleanupMedusaDev } from "./dev-cleanup.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const LOCK = resolve(root, ".medusa-dev.lock")

const ok = await cleanupMedusaDev(9000)
clearLock()
process.exit(ok ? 0 : 1)

function clearLock() {
  if (!existsSync(LOCK)) return
  try {
    unlinkSync(LOCK)
  } catch {
    /* ignore */
  }
}
