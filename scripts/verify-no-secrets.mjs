#!/usr/bin/env node
/**
 * Blocks commits/pushes that contain likely API keys, hardcoded credentials or known-compromised values in tracked files.
 * Run: npm run verify:no-secrets           (files changed since upstream, else every tracked file)
 *      node scripts/verify-no-secrets.mjs --all   (every tracked file — what CI runs)
 * Patterns: scripts/lib/secret-scan.mjs. Findings show a masked sample, never the value.
 */
import { execSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { scanText } from "./lib/secret-scan.mjs"

const MAX_BUFFER = 128 * 1024 * 1024

const SCAN_ALL = process.argv.includes("--all")

function trackedFiles() {
  if (!SCAN_ALL) {
    try {
      const upstream = execSync("git rev-parse --abbrev-ref @{upstream}", {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER,
      }).trim()
      if (upstream) {
        const out = execSync(`git diff --name-only -z ${upstream}..HEAD`, {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER,
        })
        const changed = out.split("\0").filter(Boolean)
        if (changed.length > 0) return changed
      }
    } catch {
      // no upstream or diff failed — fall back to full scan
    }
  }

  const r = spawnSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  })
  if (r.status !== 0) {
    throw new Error(r.stderr || "git ls-files failed")
  }
  return r.stdout.split("\0").filter(Boolean)
}

function scanFile(path) {
  let text
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return []
  }
  return scanText(text).map((hit) => ({ path, ...hit }))
}

const files = trackedFiles().filter(
  (file) =>
    !file.includes("node_modules/") &&
    !file.includes("/.next/") &&
    !file.endsWith(".test.ts") &&
    !file.endsWith(".test.tsx") &&
    !file.includes("/__tests__/") &&
    !file.includes("/fixtures/")
)
const violations = files.flatMap(scanFile)

if (violations.length > 0) {
  console.error("Secret scan failed — remove real keys before committing/pushing:\n")
  for (const v of violations) {
    console.error(`  • ${v.path} (${v.kind}, e.g. ${v.sample})`)
  }
  console.error("\nUse empty placeholders in .env.example (GROQ_API_KEY=\"\").")
  process.exit(1)
}

console.log("Secret scan OK")
