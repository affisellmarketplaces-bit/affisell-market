/**
 * Resolve ONE supplier-purchase claim by hand, after checking the supplier / Stripe (lib/supplier-purchase/reconcile.ts).
 * DRY-RUN by default: prints what would change. Writes only with --apply, refused on production by accident
 * (scripts/lib/production-guard.mjs) and only from `claimed` / `uncertain`.
 *
 *   DATABASE_URL='<url>' npm run resolve:supplier-purchase-claim -- --key order:<id> --as placed --supplier-order <id> [--apply]
 *   … --as rejected   (no order, no money left)
 *   … --as refunded   (no order, money returned outside: wallet credited / transfer reversed — do that FIRST)
 */
import { RESOLVE_SQL, type Resolution } from "../lib/supplier-purchase/reconcile"
import { assertNotProductionByAccident } from "./lib/production-guard.mjs"

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const arg = (n: string) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const key = arg("--key")
  const as = arg("--as") as Resolution | undefined
  const supplierOrder = arg("--supplier-order")
  const apply = argv.includes("--apply")
  if (!key || !as || !(as in RESOLVE_SQL) || (as === "placed" && !supplierOrder)) {
    console.error("usage: --key <claim id> --as placed|rejected|refunded [--supplier-order <id>] [--apply]")
    return 3
  }
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error("DATABASE_URL is not set. Pass it explicitly (this script never reads .env files).")
    return 3
  }
  assertNotProductionByAccident("scripts/resolve-supplier-purchase-claim.ts", { urlVariables: ["DATABASE_URL"] })
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] })
  try {
    const before = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM "SupplierPurchaseClaim" WHERE "id" = $1`, key)
    console.log("[resolve] current:", JSON.stringify(before[0] ?? null))
    if (!apply) {
      console.log(`[resolve] DRY-RUN: would apply '${as}'. Re-run with --apply to write.`)
      return 0
    }
    const n = await prisma.$executeRawUnsafe(RESOLVE_SQL[as], key, ...(as === "placed" ? [supplierOrder] : []))
    console.log(n === 1 ? `[resolve] applied '${as}'` : `[resolve] NOT applied (state does not allow '${as}')`)
    return n === 1 ? 0 : 2
  } finally {
    await prisma.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`[resolve] error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(3)
  },
)
