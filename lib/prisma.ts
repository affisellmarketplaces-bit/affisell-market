import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** Ensures Neon-friendly TLS and libpq connect timeout if not already set. */
export function withNeonDefaults(databaseUrl: string): string {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error("[prisma] DATABASE_URL est vide dans process.env")
  }
  try {
    const u = new URL(trimmed)
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require")
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "10")
    }
    return u.toString()
  } catch {
    const sep = trimmed.includes("?") ? "&" : "?"
    let out = trimmed
    if (!/([?&])sslmode=/.test(trimmed)) {
      out += `${sep}sslmode=require`
    }
    if (!/([?&])connect_timeout=/.test(out)) {
      out += `${out.includes("?") ? "&" : "?"}connect_timeout=10`
    }
    return out
  }
}

function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL
  if (!raw?.trim()) {
    throw new Error(
      "[prisma] DATABASE_URL est absent ou vide dans process.env. Vérifie ton fichier .env."
    )
  }
  return withNeonDefaults(raw)
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl() },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

globalForPrisma.prisma = prisma

const CONNECT_RETRIES = 3
const CONNECT_BASE_DELAY_MS = 400

/** Appelé depuis `instrumentation.ts` au démarrage (Neon peut être en veille). */
export async function connectPrismaWithRetry(): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
    try {
      await prisma.$connect()
      if (attempt > 1) {
        console.info(`[prisma] Connexion OK au bout de la tentative ${attempt}`)
      }
      return
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[prisma] $connect échec ${attempt}/${CONNECT_RETRIES}: ${msg}`)
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      if (attempt < CONNECT_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, CONNECT_BASE_DELAY_MS * attempt)
        )
      }
    }
  }
  console.error(
    "[prisma] Impossible de joindre la base après",
    CONNECT_RETRIES,
    "tentatives :",
    lastError
  )
}

export default prisma
