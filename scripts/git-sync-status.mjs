#!/usr/bin/env node
/**
 * One-line proof that Git is committed + synced (vs Cursor Agent "N Files" session list).
 *
 * Usage: node scripts/git-sync-status.mjs
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim()
const head = run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim()
const dirty = run("git", ["status", "--porcelain"]).stdout
  .trim()
  .split("\n")
  .filter(Boolean)

const upstream = run("git", ["rev-parse", "--abbrev-ref", "@{upstream}"]).stdout.trim()
let syncLine = "[git-sync] upstream: (none)"
if (upstream) {
  const counts = run("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`])
    .stdout.trim()
    .split(/\s+/)
    .map((n) => Number.parseInt(n, 10) || 0)
  const [behind, ahead] = counts
  if (behind === 0 && ahead === 0) {
    syncLine = `[git-sync] ✓ synced with ${upstream}`
  } else {
    syncLine = `[git-sync] vs ${upstream}: ↑${ahead} ahead, ↓${behind} behind`
  }
}

console.log(`[git-sync] ${branch} @ ${head}`)
console.log(syncLine)

if (dirty.length === 0) {
  console.log("[git-sync] ✓ working tree clean (0 fichiers non commités)")
} else {
  console.log(`[git-sync] ⚠ ${dirty.length} fichier(s) non commité(s):`)
  for (const line of dirty.slice(0, 8)) {
    console.log(`  ${line}`)
  }
  if (dirty.length > 8) {
    console.log(`  … +${dirty.length - 8} autres`)
  }
  process.exit(1)
}

console.log(
  "[git-sync] Cursor Agent « N Files » = historique de session, pas Git — nouvelle conversation pour réinitialiser"
)
