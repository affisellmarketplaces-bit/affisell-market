#!/usr/bin/env node
/**
 * Thin launcher kept so the documented command `node scripts/seed-prod-safe.mjs` still lands on the single gate (RSK-90, lot A).
 *
 * It resolves nothing, asks nothing, loads no env file, injects no variable and prints no result of its own. The previous version
 * resolved a target, asked the operator to type "PROD", then started a child that loaded the env files again with `override: true`
 * and resolved ANOTHER target: the target confirmed was not necessarily the target used. The gate now lives in the program that
 * writes (scripts/radar-seed-run.ts); this file only forwards its arguments and its exit status.
 *
 * `npm run radar:seed:prod` runs `scripts/seed-world-radar.ts --expect-class production` directly and does not go through here.
 * Every class of target is disabled in this version: expect exit 3 (`production_seed_disabled`).
 *
 * Exit status: the child's own code; a signal that killed it is reported as 128 + the signal number (never as a refusal); a failure
 * to start `npm` is 1. As everywhere, only a final line `state=refused` proves that nothing was written.
 */
import { spawnSync } from "node:child_process"
import { constants } from "node:os"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

const result = spawnSync("npm", ["run", "radar:seed:prod", "--", ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: false,
})

// A failure to start `npm` is a failure; a signal is 128 + its number (the shell convention), never a success.
if (result.error) process.exit(1)
if (result.signal) process.exit(128 + (constants.signals[result.signal] ?? 1))
process.exit(result.status ?? 1)
