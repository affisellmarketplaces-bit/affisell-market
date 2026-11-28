import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

/**
 * A long-lived psql process as a minimal Prisma-like raw client ($queryRawUnsafe, $executeRawUnsafe, $transaction) —
 * lets the app's REAL raw-SQL code (e.g. sqlClaimStore) run against a local PostgreSQL without the Prisma engine.
 * One instance = one database session (so N instances = N truly concurrent sessions). Local test databases only.
 */
export type RawDb = {
  $queryRawUnsafe<R = unknown>(sql: string, ...values: unknown[]): Promise<R>
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>
}

const lit = (v: unknown): string =>
  v === null || v === undefined
    ? "NULL"
    : Array.isArray(v)
      ? `ARRAY[${v.map(lit).join(",")}]::text[]`
      : typeof v === "number"
        ? String(v)
        : `'${String(v).replace(/'/g, "''")}'`
const bind = (q: string, values: unknown[]) => q.replace(/\$(\d+)/g, (_, n: string) => lit(values[Number(n) - 1]))

export class PsqlSession implements RawDb {
  private proc: ChildProcessWithoutNullStreams
  private buf = ""
  private err = ""
  private waiting: ((r: { out: string; err: string }) => void) | null = null
  private seq = 0
  private queue: Promise<unknown> = Promise.resolve()
  private inTx = false

  constructor() {
    const host = process.env.PGHOST ?? ""
    if (!/^(\/|localhost$|127\.0\.0\.1$)/.test(host)) throw new Error("PsqlSession: local PGHOST only")
    this.proc = spawn("psql", ["-qAtX", "-v", "ON_ERROR_STOP=0"], { stdio: "pipe" })
    this.proc.stdout.on("data", (d) => {
      this.buf += d
      this.flush()
    })
    this.proc.stderr.on("data", (d) => (this.err += d))
  }

  private flush() {
    const m = /__END_(\d+)__\n/.exec(this.buf)
    if (m && this.waiting) {
      const out = this.buf.slice(0, m.index)
      this.buf = this.buf.slice(m.index + m[0].length)
      const err = this.err
      this.err = ""
      const w = this.waiting
      this.waiting = null
      w({ out, err })
    }
  }

  /** Runs one statement; serialised per session. Throws on any ERROR. */
  private run(sql: string): Promise<string> {
    const step = this.queue.then(
      () =>
        new Promise<string>((resolve, reject) => {
          const id = ++this.seq
          this.waiting = ({ out, err }) => (/ERROR:/.test(err) ? reject(new Error(err.trim())) : resolve(out.trim()))
          this.proc.stdin.write(`${sql.trim().replace(/;?\s*$/, ";")}\n\\echo __END_${id}__\n`)
        }),
    )
    this.queue = step.catch(() => undefined)
    return step
  }

  async $queryRawUnsafe<R>(sql: string, ...values: unknown[]): Promise<R> {
    const q = bind(sql, values)
    // A data-modifying statement with RETURNING must be a CTE to be wrapped in json_agg.
    const wrapped = /^\s*(insert|update|delete)\b/i.test(q)
      ? `WITH q AS (${q}) SELECT coalesce(json_agg(q), '[]'::json) FROM q`
      : `SELECT coalesce(json_agg(q), '[]'::json) FROM (${q}) q`
    return JSON.parse((await this.run(wrapped)) || "[]") as R
  }

  async $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number> {
    const q = bind(sql, values)
    return Number(await this.run(`WITH q AS (${q} RETURNING 1) SELECT count(*) FROM q`))
  }

  async $transaction<R>(fn: (tx: RawDb) => Promise<R>): Promise<R> {
    if (this.inTx) throw new Error("nested transaction")
    this.inTx = true
    await this.run("BEGIN")
    try {
      const r = await fn(this)
      await this.run("COMMIT")
      return r
    } catch (e) {
      await this.run("ROLLBACK").catch(() => undefined)
      throw e
    } finally {
      this.inTx = false
    }
  }

  async close(): Promise<void> {
    this.proc.stdin.end("\\q\n")
    await new Promise((r) => this.proc.on("close", r))
  }
}
