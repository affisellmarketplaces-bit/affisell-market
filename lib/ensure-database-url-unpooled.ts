/**
 * Neon: runtime uses pooled DATABASE_URL; Prisma migrate needs a direct connection.
 * Sets DATABASE_URL_UNPOOLED (schema directUrl) + legacy DIRECT_URL alias.
 */
export function normalizeDirectDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl?.trim()) return undefined

  let direct = rawUrl.trim()

  try {
    const parsed = new URL(direct)
    if (parsed.hostname.includes("-pooler")) {
      parsed.hostname = parsed.hostname.replace(/-pooler/g, "")
    }
    parsed.searchParams.delete("pgbouncer")
    parsed.searchParams.delete("connection_limit")
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require")
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "60")
    }
    const query = parsed.searchParams.toString()
    parsed.search = query ? `?${query}` : ""
    direct = parsed.toString()
  } catch {
    direct = direct
      .replace(/-pooler/g, "")
      .replace(/([?&])pgbouncer=true&?/gi, "$1")
      .replace(/[?&]$/, "")
  }

  return direct
}

/** Mutates process.env — safe to call before `prisma migrate deploy`. */
export function ensureDatabaseUrlUnpooled(): string | undefined {
  const preset =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DIRECT_URL?.trim()
  const databaseUrl = process.env.DATABASE_URL?.trim()

  const source = preset || databaseUrl
  if (!source) return undefined

  const direct = normalizeDirectDatabaseUrl(source)
  if (!direct) return undefined

  process.env.DATABASE_URL_UNPOOLED = direct
  process.env.DIRECT_URL = direct

  if (direct !== source) {
    console.log(
      "[ensure-database-url-unpooled] DATABASE_URL_UNPOOLED normalized (pooler → direct for migrate)"
    )
  } else if (!preset && databaseUrl) {
    console.log(
      "[ensure-database-url-unpooled] DATABASE_URL_UNPOOLED derived from DATABASE_URL"
    )
  }

  return direct
}
