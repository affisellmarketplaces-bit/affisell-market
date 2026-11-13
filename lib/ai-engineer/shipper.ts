import { spawnSync } from "node:child_process"

import type { IngAction, IngShipResult } from "@/lib/ai-engineer/types"

function run(cmd: string, args: string[], timeoutMs = 90_000): { ok: boolean; output: string } {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  return { ok: result.status === 0, output }
}

/** Pushing AI-written code is opt-in: only the exact value "true" enables it (read per call, no deploy needed). */
export function isIngPushAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ING_ALLOW_PUSH === "true"
}

export class IngShipper {
  async ship(
    actions: IngAction[],
    options?: { dryRun?: boolean; message?: string; branch?: string }
  ): Promise<IngShipResult> {
    const dryRun = options?.dryRun ?? false
    const message =
      options?.message?.trim() ||
      `fix(ing): auto-fix ${actions[0]?.file ?? "affisell"} — Ing observer`

    const changedFiles = actions.map((a) => a.file).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    const uniqueFiles = [...new Set(changedFiles)]

    if (uniqueFiles.length === 0 || uniqueFiles.every((f) => f === "tsconfig.json")) {
      console.log("[ing]", { result: "ship_skip", reason: "no_file_changes" })
      return {
        commit: null,
        push: false,
        tests: { ok: true, output: "skipped — no writable file changes" },
        dryRun,
      }
    }

    if (dryRun) {
      console.log("[ing]", { result: "ship_dry_run", files: uniqueFiles, message })
      return {
        commit: null,
        push: false,
        tests: { ok: true, output: "dry-run — git skipped" },
        dryRun: true,
      }
    }

    for (const file of uniqueFiles) {
      if (file === "tsconfig.json") continue
      const add = run("git", ["add", file])
      if (!add.ok) {
        console.error("[ing]", { stage: "git_add", file, error: add.output })
      }
    }

    const commit = run("git", ["commit", "-m", message])
    let commitHash: string | null = null
    if (commit.ok) {
      const hash = run("git", ["rev-parse", "--short", "HEAD"])
      commitHash = hash.ok ? hash.output.trim() : "ok"
    } else if (!commit.output.includes("nothing to commit")) {
      console.error("[ing]", { stage: "git_commit", error: commit.output })
    }

    const migrate = run("npm", ["run", "migrate:fulfillment-groups", "--", "--dry-run"], 120_000)
    const tests = run("npx", ["vitest", "run", "lib/__tests__/ing-observer.test.ts"], 60_000)

    // `npm run push:safe` pushes `main` — production — whatever branch is checked out. The code committed here was written by a
    // model from log analysis, so it never reaches production by itself: the push only happens when the operator opted in
    // explicitly (finalisation master doc). Default = commit locally, human pushes after reading the diff.
    let pushed = false
    if (commitHash) {
      if (isIngPushAllowed()) {
        const push = run("npm", ["run", "push:safe"], 120_000)
        pushed = push.ok
        if (!push.ok) {
          console.error("[ing]", { stage: "push", error: push.output.slice(-500) })
        }
      } else {
        console.log("[ing]", { result: "push_disabled", reason: "ING_ALLOW_PUSH is not 'true'", commit: commitHash })
      }
    }

    console.log("[ing]", {
      result: "ship",
      commit: commitHash,
      pushed,
      migrateOk: migrate.ok,
      testsOk: tests.ok,
    })

    return {
      commit: commitHash,
      push: pushed,
      tests: {
        ok: tests.ok && migrate.ok,
        output: `${tests.output.slice(-800)}\n--- migrate dry-run ---\n${migrate.output.slice(-800)}`,
      },
      dryRun: false,
    }
  }
}
