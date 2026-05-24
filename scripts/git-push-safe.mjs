#!/usr/bin/env node
/**
 * Reliable push for agents & CI: secret scan, fetch with timeout, rebase only if behind, push.
 * Avoids hanging forever on `git pull` when the network or credential helper blocks.
 *
 * Usage: node scripts/git-push-safe.mjs [branch]
 * Default branch: main, remote: origin
 */
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const REMOTE = process.env.GIT_REMOTE?.trim() || "origin"
const BRANCH = process.argv[2]?.trim() || process.env.GIT_BRANCH?.trim() || "main"
const FETCH_TIMEOUT_MS = Number(process.env.GIT_FETCH_TIMEOUT_MS) || 20_000
const PUSH_TIMEOUT_MS = Number(process.env.GIT_PUSH_TIMEOUT_MS) || 45_000

const env = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
}

function run(cmd, args, { timeoutMs = 60_000, label } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: timeoutMs,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.error?.code === "ETIMEDOUT") {
    console.error(`[git-push-safe] Timeout (${timeoutMs}ms): ${label ?? `${cmd} ${args.join(" ")}`}`)
    console.error("Push non terminé — le commit local est probablement OK. Réessayez : npm run push:safe")
    process.exit(2)
  }
  return r
}

function die(msg, code = 1) {
  console.error(`[git-push-safe] ${msg}`)
  process.exit(code)
}

// 1. Secret scan (tracked files — typically <1s)
const scan = run("node", ["scripts/verify-no-secrets.mjs"], { timeoutMs: 120_000, label: "verify:no-secrets" })
if (scan.status !== 0) {
  process.stderr.write(scan.stderr || "")
  process.stdout.write(scan.stdout || "")
  process.exit(scan.status || 1)
}
console.log("[git-push-safe] Secret scan OK")

// 2. Must be on a branch with commits to push
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 5_000 })
if (branch.status !== 0) die("Not a git repository")
if (branch.stdout.trim() !== BRANCH) {
  console.warn(`[git-push-safe] Warning: on branch ${branch.stdout.trim()}, pushing ${BRANCH}`)
}

// 3. Fetch (bounded wait — no interactive prompt)
const fetch = run("git", ["fetch", REMOTE, BRANCH, "--prune"], {
  timeoutMs: FETCH_TIMEOUT_MS,
  label: `git fetch ${REMOTE} ${BRANCH}`,
})
if (fetch.status !== 0) {
  process.stderr.write(fetch.stderr || fetch.stdout || "")
  die(`git fetch failed (status ${fetch.status})`)
}

const upstream = `${REMOTE}/${BRANCH}`

// 4. Rebase only if behind remote
const behind = run("git", ["rev-list", "--count", `HEAD..${upstream}`], { timeoutMs: 5_000 })
const behindCount = Number.parseInt((behind.stdout || "0").trim(), 10) || 0

if (behindCount > 0) {
  console.log(`[git-push-safe] ${behindCount} commit(s) behind ${upstream} — rebasing…`)
  const pull = run("git", ["pull", "--rebase", REMOTE, BRANCH], {
    timeoutMs: FETCH_TIMEOUT_MS,
    label: "git pull --rebase",
  })
  if (pull.status !== 0) {
    process.stderr.write(pull.stderr || "")
    process.stdout.write(pull.stdout || "")
    die(`git pull --rebase failed — resolve conflicts then npm run push:safe`, pull.status || 1)
  }
} else {
  console.log(`[git-push-safe] Already up to date with ${upstream}`)
}

// 5. Push
const push = run("git", ["push", REMOTE, BRANCH], {
  timeoutMs: PUSH_TIMEOUT_MS,
  label: `git push ${REMOTE} ${BRANCH}`,
})
if (push.status !== 0) {
  process.stderr.write(push.stderr || "")
  process.stdout.write(push.stdout || "")
  die(`git push failed (status ${push.status})`, push.status || 1)
}

process.stdout.write(push.stdout || "")
console.log(`[git-push-safe] Pushed to ${REMOTE}/${BRANCH}`)
