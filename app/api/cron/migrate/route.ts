import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { ensureDatabaseUrlUnpooled } from "@/lib/ensure-database-url-unpooled"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Neon migrate deploy can exceed default 10s on large migration queues. */
export const maxDuration = 300

const MIGRATE_TIMEOUT_MS = 90_000

async function unlockAdvisoryLocks(): Promise<{ before: number; after: number }> {
  const holders = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT DISTINCT l.pid
    FROM pg_locks l
    JOIN pg_stat_activity a ON l.pid = a.pid
    WHERE l.locktype = 'advisory'
      AND a.pid <> pg_backend_pid()
  `

  if (holders.length > 0) {
    await prisma.$executeRaw`
      SELECT pg_terminate_backend(pid::integer)
      FROM pg_stat_activity
      WHERE pid IN (
        SELECT l.pid FROM pg_locks l WHERE l.locktype = 'advisory'
      )
        AND pid <> pg_backend_pid()
    `
  }

  const after = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT DISTINCT l.pid
    FROM pg_locks l
    JOIN pg_stat_activity a ON l.pid = a.pid
    WHERE l.locktype = 'advisory'
      AND a.pid <> pg_backend_pid()
  `

  console.log("[cron/migrate]", {
    advisoryLocksBefore: holders.length,
    advisoryLocksAfter: after.length,
    terminatedPids: holders.map((r) => r.pid),
  })

  return { before: holders.length, after: after.length }
}

function migrateSpawnEnv(): NodeJS.ProcessEnv {
  ensureDatabaseUrlUnpooled()
  return {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_CLI_BINARY_TARGETS:
      process.env.PRISMA_CLI_BINARY_TARGETS ?? "rhel-openssl-3.0.x",
  }
}

function resolvePrismaMigrateCommand(): { command: string; args: string[] } {
  const schema = join(process.cwd(), "prisma/schema.prisma")
  const migrateArgs = ["migrate", "deploy", `--schema=${schema}`]

  const npxBin = join(process.cwd(), "node_modules/.bin/npx")
  if (existsSync(npxBin)) {
    return {
      command: npxBin,
      args: ["--no-install", "prisma", ...migrateArgs],
    }
  }

  const prismaBin = join(process.cwd(), "node_modules/.bin/prisma")
  if (existsSync(prismaBin)) {
    return { command: prismaBin, args: migrateArgs }
  }

  const prismaJs = join(process.cwd(), "node_modules/prisma/build/index.js")
  if (existsSync(prismaJs)) {
    return { command: process.execPath, args: [prismaJs, ...migrateArgs] }
  }

  throw new Error("Prisma CLI not found in node_modules")
}

function runMigrateDeploy(): { ok: boolean; output: string; code: number | null } {
  const { command, args } = resolvePrismaMigrateCommand()
  console.log("[cron/migrate]", { command, args: args.join(" ") })

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: migrateSpawnEnv(),
    encoding: "utf8",
    timeout: MIGRATE_TIMEOUT_MS,
    shell: false,
  })

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
  if (result.error) {
    const errMsg = result.error instanceof Error ? result.error.message : String(result.error)
    return {
      ok: false,
      output: output ? `${output}\n${errMsg}` : errMsg,
      code: result.status ?? 1,
    }
  }

  return { ok: result.status === 0, output, code: result.status }
}

/**
 * Apply pending Prisma migrations (daily backup — primary path is build-time migrate deploy).
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  if (!process.env.DATABASE_URL?.trim()) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 })
  }

  try {
    const locks = await unlockAdvisoryLocks()

    try {
      const deploy = runMigrateDeploy()

      console.log("[cron/migrate]", {
        deployOk: deploy.ok,
        exitCode: deploy.code,
        outputTail: deploy.output.slice(-500),
      })

      if (!deploy.ok) {
        return Response.json(
          {
            ok: false,
            locks,
            exitCode: deploy.code,
            output: deploy.output,
          },
          { status: 500 }
        )
      }

      return Response.json({
        ok: true,
        locks,
        output: deploy.output,
      })
    } catch (error: unknown) {
      const err = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string }
      const stdout =
        typeof err.stdout === "string" ? err.stdout : err.stdout?.toString?.() ?? ""
      const stderr =
        typeof err.stderr === "string" ? err.stderr : err.stderr?.toString?.() ?? ""
      const message = error instanceof Error ? error.message : String(error)
      const output = `${stdout}\n${stderr}`.trim() || message

      console.log("[cron/migrate]", {
        result: "migrate_spawn_failed",
        exitCode: err.status ?? null,
        error: message,
      })

      return Response.json(
        {
          ok: false,
          locks,
          exitCode: err.status ?? null,
          output,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cron/migrate]", { error: message })
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
