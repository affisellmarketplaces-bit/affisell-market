import { timingSafeEqual } from "node:crypto"

/** Constant-time compare for `Bearer <secret>` (mitigates timing leaks on cron/job auth). */
export function secureBearerMatch(authHeader: string | null | undefined, secret: string): boolean {
  const expected = `Bearer ${secret}`
  const provided = authHeader?.trim() ?? ""
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))
  } catch {
    return false
  }
}
