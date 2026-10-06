#!/usr/bin/env node
/**
 * Emergency rollback for the service worker (public/sw.js). A bad worker cannot be "undeployed" from visitors' browsers —
 * only replaced by another worker at the same URL — so the replacement is prepared here, ready to ship.
 *
 *   node scripts/pwa-rollback.mjs offline      # PREFERRED: drop the offline shell + its caches, KEEP Web Push
 *   node scripts/pwa-rollback.mjs unregister   # remove the worker entirely (push subscriptions are lost)
 *   add --dry-run to print the result without writing
 *
 * Then: git commit + npm run push:safe (two separate commands). Browsers pick the new worker up on their next visit
 * (the browser re-checks /sw.js at least every 24h and on every navigation).
 *
 * Neither variant navigates or reloads any client: PwaShellRegister re-registers on every visit, so a worker that
 * reloaded pages would put visitors in a reload loop.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SW_PATH = resolve(process.cwd(), "public/sw.js")
const CACHE_PREFIX = "affisell-buyer-"
/** The Web Push handlers start here in public/sw.js; they are reused verbatim so the rollback can never drift from them. */
const PUSH_MARKER = 'self.addEventListener("push"'
export const ROLLBACK_MARKER = "/* AFFISELL SERVICE WORKER ROLLBACK"

const DELETE_CACHES = `caches
    .keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith("${CACHE_PREFIX}")).map((key) => caches.delete(key))))`

/** @param {"offline" | "unregister"} mode @param {string} currentWorker the current contents of public/sw.js */
export function buildRollbackWorker(mode, currentWorker) {
  if (currentWorker.includes(ROLLBACK_MARKER)) throw new Error("public/sw.js is already a rollback worker")

  if (mode === "unregister") {
    return `${ROLLBACK_MARKER}: unregister */
// Removes the worker and its caches. Never navigates/reloads clients (the page re-registers on each visit: that would loop).
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(${DELETE_CACHES}.then(() => self.registration.unregister()))
})
`
  }

  if (mode === "offline") {
    const at = currentWorker.indexOf(PUSH_MARKER)
    if (at === -1) throw new Error(`Cannot find the Web Push handlers (${PUSH_MARKER}) in public/sw.js — refusing to drop them`)
    return `${ROLLBACK_MARKER}: offline shell disabled, Web Push kept */
// No fetch handler: every request goes straight to the network again. Stored pages are deleted on activation.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(${DELETE_CACHES}.then(() => self.clients.claim()))
})

${currentWorker.slice(at)}`
  }

  throw new Error(`Unknown mode "${mode}" (use "offline" or "unregister")`)
}

function main() {
  const [mode, ...flags] = process.argv.slice(2)
  const dry = flags.includes("--dry-run")
  let result
  try {
    result = buildRollbackWorker(mode, readFileSync(SW_PATH, "utf8"))
  } catch (e) {
    console.error(`✗ ${e.message}`)
    console.error("Usage: node scripts/pwa-rollback.mjs <offline|unregister> [--dry-run]")
    process.exit(1)
  }
  if (dry) {
    console.log(result)
    return
  }
  writeFileSync(SW_PATH, result)
  console.log(`✓ public/sw.js replaced by the "${mode}" rollback worker (${result.split("\n").length} lines).`)
  console.log("Next: git commit (one command), then npm run push:safe (a separate command).")
  console.log("Undo the rollback later with: git checkout <previous-commit> -- public/sw.js")
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
