import { createRequire } from "node:module"
import { resolve } from "node:path"
import type { PrismaClient } from "@prisma/client"

/** Repo root @prisma/client (schema with medusaHandle). cwd = medusa-backend when running Medusa. */
const requireFromRepo = createRequire(resolve(process.cwd(), "../package.json"))

let prisma: PrismaClient | null = null

function loadPrismaClient(): PrismaClient {
  const mod = requireFromRepo("@prisma/client") as {
    PrismaClient: new (args?: object) => PrismaClient
  }
  const url = process.env.DATABASE_URL_PRISMA?.trim()
  if (!url) {
    throw new Error("DATABASE_URL_PRISMA missing")
  }
  return new mod.PrismaClient({
    datasources: { db: { url } },
  })
}

/** Lazy Prisma client — uses repo-root schema (includes medusaHandle). */
export function getAffisellPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL_PRISMA?.trim()) return null
  if (!prisma) {
    prisma = loadPrismaClient()
  }
  return prisma
}

export type SyncPrismaTryOnInput = {
  handle: string
  medusaProductId: string
  try_on_enabled: boolean
  tryon_garment_url?: string | null
}

export type SyncPrismaTryOnResult = {
  synced: boolean
  skipped?: boolean
  prismaProductId?: string
}

/** Direct Prisma sync (used by admin try-on route + workflow step). */
export async function syncPrismaProductTryOn(
  input: SyncPrismaTryOnInput,
  log: (msg: string) => void = console.log
): Promise<SyncPrismaTryOnResult> {
  const handle = input.handle.trim()
  const client = getAffisellPrisma()
  if (!client) {
    log(`[prisma-sync] DATABASE_URL_PRISMA missing — skip handle=${handle}`)
    return { synced: false, skipped: true }
  }

  const data = {
    tryOnEnabled: input.try_on_enabled,
    tryOnGarmentUrl: input.tryon_garment_url ?? null,
  }

  const existing = await client.product.findUnique({
    where: { medusaHandle: handle },
    select: { id: true },
  })

  if (!existing) {
    log(`[prisma-sync] no Product with medusaHandle=${handle} — skip`)
    return { synced: false, skipped: true }
  }

  const updated = await client.product.update({
    where: { id: existing.id },
    data,
  })

  log(
    `[prisma-sync] Synced Try-On to Prisma: ${handle} tryOnEnabled=${data.tryOnEnabled} prismaId=${updated.id}`
  )

  return { synced: true, prismaProductId: updated.id }
}
