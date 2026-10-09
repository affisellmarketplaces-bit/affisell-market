/**
 * One short random id per JavaScript global — i.e. per Node process — shared by every diagnostic log line
 * (`[home_race]`, `[home_cache]`, `[prisma_diag]`) so that lines of the same process can be grouped.
 *
 * SCOPE (read before drawing conclusions from it):
 *  - It identifies a Node PROCESS, not a Vercel instance, microVM or deployment: Vercel exposes no such identifier to the code.
 *  - It is stored on `globalThis`, so every bundle of the same process (RSC layer, route handlers, instrumentation) sees the same id.
 *  - It changes whenever the process restarts and has no counterpart inside PostgreSQL: a database session cannot be attributed to it.
 *  - Random, 6 characters of base 36 (~2 billion values): collisions between live processes are not a practical concern.
 *
 * No Node-only API and no side effect besides the one assignment below, so any diagnostic module may import it.
 */
const KEY = Symbol.for("affisell.runtime.instance")
const holder = globalThis as typeof globalThis & { [KEY]?: { id: string } }
const shared = (holder[KEY] ??= { id: Math.random().toString(36).slice(2, 8) })

export const RUNTIME_INSTANCE_ID: string = shared.id
