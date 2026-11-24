/**
 * Shared wiring of the READ-ONLY reports (report:listing-readiness, report:checkout-stock,
 * report:legacy-reseller-imports): describe the target, refuse production without an explicit confirmation, then read
 * through a client that refuses writes inside a transaction PostgreSQL keeps read-only.
 *
 *   --target                       print the database, the tables and the guarantees, then exit (no connection)
 *   --confirm-endpoint=<ep-id>     required to read a PRODUCTION (or unidentified) database
 */
import { existsSync, readFileSync } from "node:fs"

import { PrismaClient, type Prisma } from "@prisma/client"
import { config, parse } from "dotenv"

import {
  decideReportRun,
  describeReportTarget,
  type ReportDatabaseTarget,
} from "../../lib/reports/report-target"
import { readOnlyPrismaClient, withReadOnlyTransaction } from "../../lib/strategic-intelligence/fee-reconciliation-run"
import { classifyDatabaseUrl } from "../schema-deploy.mjs"

function databaseUrlSource(): ReportDatabaseTarget["source"] {
  if (process.env.DATABASE_URL?.trim()) return "shell"
  for (const file of [".env.local", ".env"] as const) {
    if (!existsSync(file)) continue
    try {
      if (parse(readFileSync(file)).DATABASE_URL?.trim()) return file
    } catch {
      /* unreadable file: try the next one */
    }
  }
  return "absent"
}

export async function runReadOnlyReport<T>(
  scope: { tables: string[]; purpose: string },
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  print: (result: T, target: ReportDatabaseTarget) => void,
  options: { allowProduction?: boolean; onNotRun?: (reason: string) => void } = {}
): Promise<void> {
  const source = databaseUrlSource()
  config({ path: ".env.local" })
  config({ path: ".env" })
  const url = process.env.DATABASE_URL ?? ""
  const info = url ? classifyDatabaseUrl(url) : { endpoint: "-", branch: "unknown", maskedHost: "-" }
  const target: ReportDatabaseTarget = {
    source,
    endpoint: String(info.endpoint),
    branch: info.branch as ReportDatabaseTarget["branch"],
    maskedHost: String(info.maskedHost),
  }
  const confirmArg = process.argv.find((a) => a.startsWith("--confirm-endpoint="))
  const decision = decideReportRun({
    target,
    targetOnly: process.argv.includes("--target"),
    confirmEndpoint: confirmArg ? confirmArg.split("=")[1] ?? "" : null,
    allowProduction: options.allowProduction,
  })
  for (const line of describeReportTarget(target, scope)) console.error(`[report] ${line}`)
  if (decision.action === "describe") return
  if (decision.action === "refuse") {
    console.error(`[report] REFUSÉ — ${decision.reason}`)
    process.exitCode = 2
    options.onNotRun?.(decision.reason)
    return
  }
  const base = new PrismaClient()
  try {
    const result = await withReadOnlyTransaction(readOnlyPrismaClient(base), work)
    print(result, target)
  } finally {
    await base.$disconnect()
  }
}
