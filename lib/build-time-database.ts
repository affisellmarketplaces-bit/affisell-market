/** True while `next build` is collecting static page data. */
export function isNextProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build"
}

/**
 * Prisma during static generation can hang on cold Neon (Vercel ~8–10 min kill).
 * Runtime requests and tests with injected data still use the database.
 */
export function shouldQueryDatabaseDuringBuild(): boolean {
  if (!process.env.DATABASE_URL?.trim()) return false
  if (isNextProductionBuildPhase()) return false
  return true
}
