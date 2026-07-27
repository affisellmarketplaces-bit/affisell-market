/** Split Postgres migration SQL — respects `$$ ... $$` blocks (DO / functions). */
export function splitPostgresMigrationSql(sql: string): string[] {
  const statements: string[] = []
  let buf = ""
  let i = 0

  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const nl = sql.indexOf("\n", i)
      i = nl === -1 ? sql.length : nl + 1
      continue
    }

    const dollar = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/)
    if (dollar) {
      const tag = dollar[0]
      const close = sql.indexOf(tag, i + tag.length)
      if (close === -1) {
        throw new Error("Unclosed dollar-quoted block in migration SQL")
      }
      buf += sql.slice(i, close + tag.length)
      i = close + tag.length
      continue
    }

    const ch = sql[i]
    if (ch === ";") {
      const trimmed = buf.trim()
      if (trimmed) statements.push(trimmed)
      buf = ""
      i += 1
      continue
    }

    buf += ch
    i += 1
  }

  const tail = buf.trim()
  if (tail) statements.push(tail)
  return statements
}

export function isBenignMigrationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /already exists|duplicate key|duplicate_object|IF NOT EXISTS/i.test(msg)
}
