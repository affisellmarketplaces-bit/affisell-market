import { prisma } from "@/lib/prisma"

let ensured = false
let ensurePromise: Promise<boolean> | null = null

function isMissingCarrierColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /shippingCarrierIds/i.test(msg) && /does not exist|P2022|Unknown field/i.test(msg)
}

async function applyShippingCarrierDdl(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingCarrierIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`
  )
}

/**
 * Idempotent DDL — supplier PDP carrier cards stay up if migrate lags on an env.
 */
export async function ensureShippingCarrierSchema(options?: {
  force?: boolean
}): Promise<boolean> {
  if (ensured && !options?.force) return true
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    try {
      if (!options?.force) {
        try {
          await prisma.$queryRaw`SELECT "shippingCarrierIds" FROM "Product" LIMIT 1`
          ensured = true
          return true
        } catch (probeError: unknown) {
          if (!isMissingCarrierColumnError(probeError)) {
            console.log("[shipping-carrier]", {
              result: "schema_probe_failed",
              error:
                probeError instanceof Error ? probeError.message : String(probeError),
            })
            return false
          }
          console.log("[shipping-carrier]", { result: "fallback_ensure" })
        }
      } else {
        console.log("[shipping-carrier]", { result: "forced_ensure" })
      }

      await applyShippingCarrierDdl()
      ensured = true
      console.log("[shipping-carrier]", { result: "schema_ensured" })
      return true
    } catch (e: unknown) {
      console.log("[shipping-carrier]", {
        result: "schema_ensure_failed",
        error: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}
