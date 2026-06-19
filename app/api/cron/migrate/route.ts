import { spawnSync } from "node:child_process"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { ensureDatabaseUrlUnpooled } from "@/lib/ensure-database-url-unpooled"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Neon migrate deploy can exceed default 10s on large migration queues. */
export const maxDuration = 300

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

function runMigrateDeploy(): { ok: boolean; output: string; code: number | null } {
  ensureDatabaseUrlUnpooled()

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    timeout: 240_000,
  })

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
  return { ok: result.status === 0, output, code: result.status }
}

/**
 * Apply pending Prisma migrations once (post-deploy).
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cron/migrate]", { error: message })
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
