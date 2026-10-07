#!/usr/bin/env node
/**
 * Vercel build (vercel.json: `node scripts/vercel-build.mjs`).
 *
 *   1. prisma generate                                        no database
 *   2. SCHEMA VERIFY  node scripts/schema-deploy.mjs verify   HARD FAIL; READ-ONLY (the database session itself refuses writes):
 *                                                             the schema must already be migrated and proven in the catalog
 *   3. check:client-prisma
 *   4. APPLICATION BUILD   npm run build                      never writes to PostgreSQL (lib/build-write-guard.ts)
 *
 * The build NEVER migrates. Migrating is a separate step that runs BEFORE the push, on purpose, with an explicit target:
 *     DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep>      then      git push
 * A schema that is not migrated makes step 2 fail (exit 5): no application build, hence no deployment. `BUILD_RUN_MIGRATIONS`
 * (which used to turn this build into a migration) is gone — not read here, not set in vercel.json — and `schema:migrate` itself
 * refuses to run in any Vercel context, so re-adding it to the plan below would only produce a refusal.
 *
 * What this script no longer does, and why (docs/DEPLOY-SCHEMA-CHANGES.md): it read `.env*` files with `override: true`, ran
 * `db:unlock` (terminated any session holding an advisory lock — payment transactions included), ran prisma/deploy-repair.sql
 * (DDL) and prisma/fix-p3009-migrations.sql (recorded a FAILED migration as applied), turned a failed `migrate deploy` into a
 * warning so the build — and the deployment — went on, and (until S1.6.1) could itself run `migrate deploy`.
 *
 * Pure planning functions are exported for tests; the commands only run when this file is executed directly.
 */
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { hasDeveloperEnvFiles } from "./build-isolated.mjs"

/**
 * @typedef {{ name: string, command: string }} Step
 * @param {Record<string, string | undefined>} env
 * @param {{ developerMachine: boolean }} options
 * @returns {{ refused?: string, steps: Step[] }}
 */
export function planVercelBuild(env, { developerMachine }) {
  if (env.VERCEL !== "1") {
    return {
      refused: "not a Vercel build (VERCEL is not 1). Locally: `npm run schema:migrate -- --expect-endpoint <ep>` then `npm run build`.",
      steps: [],
    }
  }
  if (developerMachine) {
    return {
      refused:
        "VERCEL=1 on a developer machine (secret .env files present): `vercel build` run locally is not a Vercel builder. " +
        "Push to git and let Vercel build, or use `npm run schema:migrate` / `npm run build` on purpose.",
      steps: [],
    }
  }
  return {
    steps: [
      { name: "prisma generate", command: "npx prisma generate" },
      { name: "schema verify", command: "node scripts/schema-deploy.mjs verify" },
      { name: "check:client-prisma", command: "npm run check:client-prisma" },
      { name: "application build", command: "npm run build" },
    ],
  }
}

/**
 * Runs the steps in order and STOPS at the first failure: later steps never run.
 * @param {Step[]} steps
 * @param {(step: Step) => number} run exit code of a step
 * @returns {{ code: number, failed?: Step, ran: string[] }}
 */
export function runSteps(steps, run) {
  const ran = []
  for (const step of steps) {
    ran.push(step.name)
    const code = run(step)
    if (code !== 0) return { code, failed: step, ran }
  }
  return { code: 0, ran }
}

function main() {
  const env = process.env
  const plan = planVercelBuild(env, { developerMachine: hasDeveloperEnvFiles(process.cwd()) })
  if (plan.refused) {
    console.error(`✗ [vercel-build] REFUSED: ${plan.refused}`)
    return 2
  }

  if (!`${env.NODE_OPTIONS ?? ""}`.includes("max-old-space-size")) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --max-old-space-size=6144`.trim()
  }
  console.log("BUILD_START")
  const result = runSteps(plan.steps, (step) => {
    console.log(`\n> [${step.name}] ${step.command}`)
    // A spawn failure (status null) is a failure too.
    return spawnSync(step.command, { shell: true, stdio: "inherit", env }).status ?? 1
  })
  if (result.code !== 0) {
    console.error(`\n✗ Vercel build STOPPED at "${result.failed?.name}" (exit ${result.code}). Nothing after it ran: no application build, no deployment.`)
    return result.code
  }
  console.log("\nNext.js build completed")
  console.log("✓ Vercel build completed successfully.")
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main())
}
