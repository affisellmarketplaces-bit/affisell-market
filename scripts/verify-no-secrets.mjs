#!/usr/bin/env node
/**
 * Blocks commits/pushes that contain likely API keys in tracked files.
 * Run: npm run verify:no-secrets
 */
import { execSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const PATTERNS = [
  { name: "Groq API key", re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "Stripe secret key", re: /\bsk_live_[A-Za-z0-9]{10,}\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
]

const MAX_BUFFER = 128 * 1024 * 1024

function trackedFiles() {
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
  const hits = []
  for (const { name, re } of PATTERNS) {
    const m = text.match(re)
    if (m) hits.push({ path, kind: name, sample: `${m[0].slice(0, 12)}…` })
  }
  return hits
}

const files = trackedFiles().filter(
  (file) => !file.includes("node_modules/") && !file.includes("/.next/")
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
