import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { planVercelBuild, runSteps } from "../../scripts/vercel-build.mjs"

/**
 * The Vercel build is SCHEMA VERIFY (hard fail, read-only) → APPLICATION BUILD; it never migrates. A failed migration must stop the pipeline: the application build
 * never runs, so Vercel has nothing to deploy. These tests pin the plan, the stop-at-first-failure rule, and that the
 * mechanisms the audit found dangerous are gone from every automatic path.
 */

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")
/** Source without comments: what the code DOES, not what its documentation says. */
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "vercel-build-"))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe("planVercelBuild", () => {
  const vercel = { VERCEL: "1", VERCEL_ENV: "production" }
  const EXPECTED = ["npx prisma generate", "node scripts/schema-deploy.mjs verify", "npm run check:client-prisma", "npm run build"]

  it("generate → SCHEMA VERIFY → client check → APPLICATION BUILD, in that order", () => {
    const plan = planVercelBuild(vercel, { developerMachine: false })
    expect(plan.refused).toBeUndefined()
    expect(plan.steps.map((s) => s.command)).toEqual(EXPECTED)
  })

  it("BUILD_RUN_MIGRATIONS is neutralised: whatever its value, the build only VERIFIES and never migrates", () => {
    for (const value of [undefined, "0", "1", "", "true", "yes", "migrate"]) {
      const plan = planVercelBuild({ ...vercel, BUILD_RUN_MIGRATIONS: value }, { developerMachine: false })
      expect(plan.steps.map((s) => s.command), String(value)).toEqual(EXPECTED)
    }
  })

  it("the same in every Vercel environment (production, preview, development)", () => {
    for (const VERCEL_ENV of ["production", "preview", "development"]) {
      const plan = planVercelBuild({ VERCEL: "1", VERCEL_ENV, BUILD_RUN_MIGRATIONS: "1" }, { developerMachine: false })
      expect(plan.steps.map((s) => s.command), VERCEL_ENV).toEqual(EXPECTED)
    }
  })

  it("the schema step comes BEFORE the application build — never the other way round", () => {
    const names = planVercelBuild(vercel, { developerMachine: false }).steps.map((s) => s.name)
    expect(names.indexOf("schema verify")).toBeGreaterThan(-1)
    expect(names.indexOf("schema verify")).toBeLessThan(names.indexOf("application build"))
    expect(names.indexOf("application build")).toBe(names.length - 1)
  })

  it("nothing in the plan can migrate, unlock sessions, repair the schema with SQL, or mark a migration as applied", () => {
    const commands = planVercelBuild({ ...vercel, BUILD_RUN_MIGRATIONS: "1" }, { developerMachine: false }).steps.map((s) => s.command).join("\n")
    expect(commands).not.toMatch(/schema-deploy\.mjs migrate|schema:migrate|unlock|deploy-repair|fix-p3009|db execute|resolve|migrate deploy|migrate resolve|prisma migrate/)
  })

  it("refused on a developer machine (`vercel build` run locally) and outside Vercel: no step at all", () => {
    for (const [env, machine] of [
      [vercel, true],
      [{ VERCEL: "1", VERCEL_ENV: "preview" }, true],
      [{}, false],
      [{ CI: "1" }, false],
    ] as const) {
      const plan = planVercelBuild(env, { developerMachine: machine })
      expect(plan.refused, JSON.stringify(env)).toBeTruthy()
      expect(plan.steps).toEqual([])
    }
  })
})

describe("TEST 2 — a failed migration: the build must not continue", () => {
  const plan = planVercelBuild({ VERCEL: "1", VERCEL_ENV: "production" }, { developerMachine: false })

  it("the schema step fails (any exit code ≠ 0) → the application build NEVER runs", () => {
    for (const code of [1, 2, 3, 4, 5, 137]) {
      const executed: string[] = []
      const result = runSteps(plan.steps, (step) => {
        executed.push(step.command)
        return step.name.startsWith("schema") ? code : 0
      })
      expect(result.code, String(code)).toBe(code)
      expect(result.failed?.name).toBe("schema verify")
      expect(executed).toEqual(["npx prisma generate", "node scripts/schema-deploy.mjs verify"])
      expect(executed).not.toContain("npm run build")
      expect(executed).not.toContain("npm run check:client-prisma")
    }
  })

  it("when every step succeeds, they all run, in order", () => {
    const executed: string[] = []
    const result = runSteps(plan.steps, (step) => (executed.push(step.name), 0))
    expect(result).toMatchObject({ code: 0 })
    expect(executed).toEqual(["prisma generate", "schema verify", "check:client-prisma", "application build"])
  })

  it("the same stop rule holds for every step: the first failure ends the pipeline", () => {
    for (const failing of plan.steps) {
      const executed: string[] = []
      const result = runSteps(plan.steps, (step) => (executed.push(step.name), step === failing ? 7 : 0))
      expect(result.code).toBe(7)
      expect(executed[executed.length - 1]).toBe(failing.name)
    }
  })

  it("the script exits with the failing step's code and says that nothing after it ran (source check)", () => {
    const code = codeOf(read("scripts/vercel-build.mjs"))
    expect(code).toMatch(/process\.exit\(main\(\)\)/)
    expect(code).toMatch(/\?\? 1/) // a spawn failure (status null) is a failure
    expect(code).toMatch(/return result\.code/)
  })
})

describe("the real script (subprocess) — refusals happen before any command runs", () => {
  const SCRIPT = resolve("scripts/vercel-build.mjs")
  const run = (env: Record<string, string>, cwd: string) =>
    spawnSync(process.execPath, [SCRIPT], {
      cwd,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 60_000,
    })

  it("TEST 6 — `vercel build` run on a developer machine (VERCEL=1 + .env.local): refused, nothing executed, exit 2", () => {
    const result = run({ VERCEL: "1", VERCEL_ENV: "production", BUILD_RUN_MIGRATIONS: "1" }, tempDir({ ".env.local": "DATABASE_URL=x" }))
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/REFUSED.*developer machine/)
    expect(result.stdout).not.toMatch(/BUILD_START|prisma generate|schema/)
  })

  it("outside Vercel it refuses too (the schema step there is `npm run schema:migrate`, on purpose)", () => {
    const result = run({}, tempDir())
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/not a Vercel build/)
  })
})

describe("END TO END — the real vercel-build.mjs, in a clean checkout, with recording stand-ins for npx / npm / the schema script", () => {
  // A clean directory (no secret .env file: it looks like a Vercel builder) holding a stub `scripts/schema-deploy.mjs`, and a PATH whose
  // first entries are fake `npx` / `npm` that only append what they were asked to a log. Nothing real runs; no database exists.
  function checkout(schemaExit: number) {
    const dir = tempDir()
    const bin = join(dir, "fakebin")
    const log = join(dir, "calls.log")
    mkdirSync(bin)
    mkdirSync(join(dir, "scripts"))
    for (const tool of ["npx", "npm"]) {
      writeFileSync(join(bin, tool), `#!/bin/sh\necho "${tool} $*" >> "${log}"\nexit 0\n`)
      chmodSync(join(bin, tool), 0o755)
    }
    writeFileSync(join(dir, "scripts/schema-deploy.mjs"), `import { appendFileSync } from "node:fs"\nappendFileSync(${JSON.stringify(log)}, "schema-deploy " + process.argv.slice(2).join(" ") + "\\n")\nprocess.exit(${schemaExit})\n`)
    return { dir, log, bin }
  }
  const SCRIPT = resolve("scripts/vercel-build.mjs")
  const run = (c: ReturnType<typeof checkout>, env: Record<string, string>) =>
    spawnSync(process.execPath, [SCRIPT], {
      cwd: c.dir,
      env: { PATH: `${c.bin}:${process.env.PATH ?? ""}`, HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 60_000,
    })
  const calls = (c: ReturnType<typeof checkout>) => (existsSync(c.log) ? readFileSync(c.log, "utf8").trim().split("\n") : [])

  it("TEST 6 — a Vercel production build with BUILD_RUN_MIGRATIONS=1 asks for `verify`, NEVER `migrate`, then builds", () => {
    const c = checkout(0)
    const result = run(c, { VERCEL: "1", VERCEL_ENV: "production", BUILD_RUN_MIGRATIONS: "1", DATABASE_URL: "postgresql://u:p@db.invalid/x" })
    expect(result.status).toBe(0)
    expect(calls(c)).toEqual(["npx prisma generate", "schema-deploy verify", "npm run check:client-prisma", "npm run build"])
    expect(calls(c).join("\n")).not.toMatch(/migrate/)
  })

  it("the same in Preview and with the variable unset or 0", () => {
    const environments: Array<Record<string, string>> = [
      { VERCEL: "1", VERCEL_ENV: "preview", BUILD_RUN_MIGRATIONS: "1" },
      { VERCEL: "1", VERCEL_ENV: "preview" },
      { VERCEL: "1", VERCEL_ENV: "production", BUILD_RUN_MIGRATIONS: "0" },
    ]
    for (const env of environments) {
      const c = checkout(0)
      expect(run(c, env).status).toBe(0)
      expect(calls(c)[1], JSON.stringify(env)).toBe("schema-deploy verify")
      expect(calls(c).join("\n")).not.toMatch(/migrate/)
    }
  })

  it("TEST 2 — the schema step exits non-zero: the pipeline exits with that code and the application build is NEVER invoked", () => {
    for (const code of [2, 4, 5]) {
      const c = checkout(code)
      const result = run(c, { VERCEL: "1", VERCEL_ENV: "production", BUILD_RUN_MIGRATIONS: "1" })
      expect(result.status, String(code)).toBe(code)
      expect(calls(c), String(code)).toEqual(["npx prisma generate", "schema-deploy verify"])
      expect(result.stderr).toMatch(/STOPPED at "schema verify"/)
      expect(result.stdout).not.toMatch(/Vercel build completed successfully/)
    }
  })
})

describe("what the audit found dangerous is gone from every automatic path", () => {
  it("scripts/vercel-build.mjs: no .env loading, no unlock, no SQL repair, no warn-only, no 'continuing build'", () => {
    const code = codeOf(read("scripts/vercel-build.mjs"))
    for (const forbidden of [/dotenv/i, /loadEnv/, /db:unlock/, /deploy-repair/, /fix-p3009/, /execSqlFile/, /runWarnOnly/, /warn-only/i, /continuing build/i, /ensureDirectUrl/, /healMigrationHistory/, /migrate resolve/, /BUILD_RUN_MIGRATIONS/, /schema-deploy\.mjs migrate/]) {
      expect(code, String(forbidden)).not.toMatch(forbidden)
    }
  })

  it("the SQL files that recorded a failed migration as applied (and repaired the schema at every build) no longer exist", () => {
    for (const path of ["prisma/fix-p3009-migrations.sql", "prisma/deploy-repair.sql", "lib/cron/migrate-sql.ts"]) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
  })

  it("no automatic path writes `_prisma_migrations` or runs `resolve --applied` (app, lib, scripts, workflows, package.json, vercel.json)", () => {
    const skip = new Set(["node_modules", ".next", ".git", "__tests__", "medusa-backend", "apps", "packages", ".open-next", ".pnpm-store"])
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(ts|tsx|mjs|js|sql|yml|yaml|sh)$/.test(entry.name)) files.push(path)
      }
    }
    for (const dir of ["app", "lib", "scripts", "prisma", ".github"]) walk(join(root, dir))
    const offenders = files
      .filter((file) => !file.includes(`${join("prisma", "migrations")}`))
      .filter((file) => {
        const code = codeOf(readFileSync(file, "utf8"))
        return /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"_prisma_migrations"/i.test(code) || /["'`]--applied["'`]/.test(code)
      })
      .map((file) => relative(root, file))
    expect(offenders).toEqual([])
    for (const path of ["package.json", "vercel.json"]) expect(read(path)).not.toMatch(/--applied/)
  })

  it("`db:unlock` is not referenced by the build, the install, or any workflow", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (name === "db:unlock") continue
      expect(command, name).not.toMatch(/db:unlock|unlock-migrations/)
    }
    for (const workflow of readdirSync(join(root, ".github/workflows"))) {
      expect(read(`.github/workflows/${workflow}`), workflow).not.toMatch(/unlock/)
    }
  })

  it("the unlock tool no longer reads .env files, no longer terminates by default, and never targets application locks", () => {
    const source = read("scripts/unlock-migrations.ts")
    const code = codeOf(source)
    expect(code).not.toMatch(/dotenv|config\(\{ path/)
    expect(code).not.toMatch(/from ["']@prisma\/client["']/) // imported dynamically, after the explicit URL exists
    expect(code).toMatch(/await import\("@prisma\/client"\)/)
    expect(code.indexOf("EXPLICIT_DATABASE_URL")).toBeLessThan(code.indexOf('import("@prisma/client")'))
    expect(code).toMatch(/options\.terminate/)
    expect(code).toMatch(/classifyAdvisoryLocks/)
    expect(code.match(/pg_terminate_backend/g)).toHaveLength(1)
    expect(code).toMatch(/--pid/)
  })

  it("/api/cron/migrate is a READ-ONLY diagnostic: no write, no DDL, no heal, nothing marked applied", () => {
    const code = codeOf(read("app/api/cron/migrate/route.ts"))
    expect(code).not.toMatch(/\$executeRaw|executeRawUnsafe|\.create\(|\.update\(|\.delete\(|\.upsert\(/)
    expect(code).not.toMatch(/UPDATE\s+"|INSERT\s+INTO|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+/i)
    expect(code).not.toMatch(/heal|markMigrationApplied|isBenign|splitPostgresMigrationSql/)
    expect(code).toMatch(/\$queryRaw/)
    expect(code).toMatch(/authorizeCronRequest/)
  })
})

describe("configuration", () => {
  it("Vercel runs the same entry point; BUILD_RUN_MIGRATIONS is GONE from vercel.json", () => {
    const vercel = JSON.parse(read("vercel.json")) as { buildCommand: string; build: { env: Record<string, string> } }
    expect(vercel.buildCommand).toBe("node scripts/vercel-build.mjs")
    expect(Object.keys(vercel.build.env)).not.toContain("BUILD_RUN_MIGRATIONS")
    expect(Object.keys(vercel.build.env).filter((key) => /migrat/i.test(key))).toEqual([]) // (the cron PATH /api/cron/migrate is the read-only diagnostic)
  })

  it("no file of the pipeline READS BUILD_RUN_MIGRATIONS any more (documentation and tests may mention it)", () => {
    const skip = new Set(["node_modules", ".next", ".git", "__tests__", "medusa-backend", "apps", "packages", ".open-next", ".pnpm-store"])
    const readers: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(ts|tsx|mjs|js|json|yml|yaml|sh)$/.test(entry.name) && /BUILD_RUN_MIGRATIONS/.test(codeOf(readFileSync(path, "utf8")))) readers.push(relative(root, path))
      }
    }
    for (const dir of ["app", "lib", "scripts", "prisma", ".github", "workers"]) walk(join(root, dir))
    for (const file of ["package.json", "vercel.json", "next.config.ts", "prisma.config.ts", "proxy.ts", "instrumentation.ts"]) {
      if (/BUILD_RUN_MIGRATIONS/.test(codeOf(read(file)))) readers.push(file)
    }
    expect(readers).toEqual([])
  })

  it("the schema commands exist and point at the orchestrator", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    expect(pkg.scripts["schema:migrate"]).toBe("node scripts/schema-deploy.mjs migrate")
    expect(pkg.scripts["schema:verify"]).toBe("node scripts/schema-deploy.mjs verify")
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit -p .")
  })

  it("`npm run build` — the application build — never contains a schema step: it cannot write to PostgreSQL by construction", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    // (`--schema=prisma/radar.schema.prisma` is Prisma's own flag for `prisma generate`: no database involved.)
    const schemaStep = /schema-deploy|schema:(migrate|verify)|migrate|unlock/
    expect(pkg.scripts.build).not.toMatch(schemaStep)
    expect(pkg.scripts.postinstall).not.toMatch(schemaStep)
    expect(pkg.scripts.build).toContain("node scripts/build-isolated.mjs")
  })
})
