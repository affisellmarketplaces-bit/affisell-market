/**
 * Backfill BookingSeat rows for EXPERIENCE slots created before Phase 3.
 * Run: npx tsx scripts/backfill-booking-seats.ts
 */
import { backfillNamedSeatsForExperienceSlots } from "@/lib/booking/backfill-named-seats"
import { prisma } from "@/lib/prisma"

async function main() {
  const result = await backfillNamedSeatsForExperienceSlots()
  console.log("[backfill-booking-seats]", result)
}

main()
  .catch((e) => {
    console.error("[backfill-booking-seats] failed", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
