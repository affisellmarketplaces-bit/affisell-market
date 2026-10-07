/**
 * `next build` must NEVER write to a database.
 *
 * Static generation runs application code (page loaders, `generateStaticParams`…) against whatever DATABASE_URL the
 * environment holds. Reading at build time is how a static page gets its data; WRITING is never legitimate there — and
 * a local `npm run build` with a production URL used to execute idempotent DDL (`ensurePulseBattleSchema`) on production.
 *
 * This guard is installed on every Prisma client (see `lib/prisma.ts`, `lib/prisma-radar.ts`) as the OUTERMOST client
 * extension. While Next reports the production-build phase, any operation that is not a known read is refused BEFORE it
 * reaches the query engine (so no connection is even attempted): it throws `BuildPhaseWriteBlockedError`.
 *
 *   - model operations: only the read allow-list passes (findUnique/findFirst/findMany/count/aggregate/groupBy…);
 *     create/update/upsert/delete (and any operation we do not know) are refused — fail closed.
 *   - raw SQL: `$executeRaw*` is always a write; `$queryRaw*` passes only if the statement is a single, read-only SELECT
 *     (`isReadOnlySql`) — DDL, DML, `SELECT … INTO`, `FOR UPDATE`, multi-statements and anything unparseable are refused.
 *
 * Outside the build phase (runtime, dev, tests, scripts) the BUILD rule does nothing at all. There is deliberately NO override: a
 * migration is a separate process (Prisma CLI), not Prisma Client code running inside `next build`.
 *
 * The same extension carries a second, independent rule (lib/developer-production-guard.ts): a WRITE to the PRODUCTION database from a
 * DEVELOPER MACHINE is refused unless the endpoint was confirmed (`AFFISELL_ALLOW_PRODUCTION_WRITES=<ep>`). It needs the URL the client
 * was created with (`options.databaseUrl`) and is inert on any real host.
 *
 * It does not move the problem elsewhere: callers such as `ensurePulseBattleSchema` keep their own try/catch, see the
 * refusal in their log (`[build-guard]`), and carry on — the objects they used to "ensure" are created by migrations.
 */
import { isNextProductionBuildPhase } from "@/lib/build-time-database"
import { assertDeveloperProductionWriteAllowed } from "@/lib/developer-production-guard"

export class BuildPhaseWriteBlockedError extends Error {
  readonly operation: string
  readonly model: string | null

  constructor(operation: string, model: string | null, reason: string) {
    super(
      `[build-guard] Database write refused during \`next build\` (${model ? `${model}.` : ""}${operation}): ${reason}. ` +
        "Static generation must be read-only; schema changes belong to migrations."
    )
    this.name = "BuildPhaseWriteBlockedError"
    this.operation = operation
    this.model = model
  }
}

/** Model operations known to only read. Everything else is treated as a write. */
export const READ_MODEL_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

/**
 * Words that make a statement a write although it STARTS like a read: a data-modifying CTE (`WITH x AS (DELETE …)`),
 * `SELECT … FOR UPDATE` (row locks) and `SELECT … INTO` (creates a table). DDL and every other statement type are
 * already refused by the leading-keyword rule in `isReadOnlySql`, and `;` is refused too, so they need no entry here.
 */
const WRITE_WORDS = /\b(insert|update|delete|merge|into)\b/

/**
 * True only for ONE read-only statement (SELECT / WITH … SELECT / SHOW / EXPLAIN without ANALYZE / VALUES).
 * Comments, string literals, quoted identifiers ("createdAt") and dollar-quoted bodies are removed first, so a column
 * or a string that merely contains a word like `update` does not trigger it.
 */
export function isReadOnlySql(sql: string): boolean {
  const body = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "$$")
    .trim()
    .toLowerCase()
    .replace(/;\s*$/, "")
  if (body.length === 0) return false
  if (body.includes(";")) return false
  if (!/^(select|with|show|explain|values)\b/.test(body)) return false
  if (/^explain\s+(\(.*?\)\s*)?analyze\b/.test(body) || /^explain\s*\(.*\banalyze\b/.test(body)) return false
  return !WRITE_WORDS.test(body)
}

/** The SQL text of a `$queryRaw*` / `$executeRaw*` call, whatever shape the client extension hands over. */
export function extractRawSql(args: unknown): string | null {
  const first: unknown = Array.isArray(args) && !("raw" in args) ? args[0] : args
  if (typeof first === "string") return first
  if (Array.isArray(first)) return first.join(" ? ") // TemplateStringsArray (tagged template)
  if (first && typeof first === "object") {
    const o = first as { sql?: unknown; text?: unknown; strings?: unknown; query?: unknown; raw?: unknown }
    if (typeof o.sql === "string") return o.sql // Prisma.Sql
    if (typeof o.text === "string") return o.text
    if (typeof o.query === "string") return o.query
    if (Array.isArray(o.strings)) return (o.strings as string[]).join(" ? ")
    if (Array.isArray(o.raw)) return (o.raw as string[]).join(" ? ")
  }
  return null
}

export type OperationVerdict = { write: false } | { write: true; reason: string }

export function classifyOperation(operation: string, args?: unknown): OperationVerdict {
  if (READ_MODEL_OPERATIONS.has(operation)) return { write: false }
  if (operation === "$queryRaw" || operation === "$queryRawUnsafe") {
    const sql = extractRawSql(args)
    if (sql === null) return { write: true, reason: "raw query text could not be read, so it cannot be proven read-only" }
    return isReadOnlySql(sql) ? { write: false } : { write: true, reason: "raw SQL is not a single read-only statement" }
  }
  if (operation === "$executeRaw" || operation === "$executeRawUnsafe") return { write: true, reason: "raw execute" }
  return { write: true, reason: "not a known read operation" }
}

/** Throws `BuildPhaseWriteBlockedError` for a write while `next build` runs. No-op at runtime, in dev, tests and scripts. */
export function assertBuildWriteAllowed(operation: string, args?: unknown, model?: string | null): void {
  if (!isNextProductionBuildPhase()) return
  const verdict = classifyOperation(operation, args)
  if (!verdict.write) return
  const error = new BuildPhaseWriteBlockedError(operation, model ?? null, verdict.reason)
  console.error("[build-guard]", { result: "write_blocked", operation, model: model ?? null, reason: verdict.reason })
  throw error
}

type Extendable = { $extends: (...args: any[]) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Installs the guard on a Prisma client. Apply it LAST (outermost): a refused write must never enter the reconnect /
 * retry / circuit-breaker logic nor reach the engine.
 */
export function withBuildWriteGuard<T extends Extendable>(client: T, options: { databaseUrl?: string | null } = {}): T {
  return client.$extends({
    name: "affisell-build-write-guard",
    query: {
      $allOperations({ model, operation, args, query }: { model?: string; operation: string; args: unknown; query: (a: unknown) => Promise<unknown> }) {
        assertBuildWriteAllowed(operation, args, model)
        if (options.databaseUrl) {
          const verdict = classifyOperation(operation, args)
          assertDeveloperProductionWriteAllowed({
            operation,
            model,
            write: verdict.write,
            reason: verdict.write ? verdict.reason : undefined,
            databaseUrl: options.databaseUrl,
          })
        }
        return query(args)
      },
    },
  }) as T
}
