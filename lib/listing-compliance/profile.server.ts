import "server-only"

import { Prisma } from "@prisma/client"

import {
  COMPLIANCE_PROFILE_FIELDS,
  EMPTY_COMPLIANCE_PROFILE,
  type ComplianceProfile,
} from "@/lib/listing-compliance/profile-shared"
import { prisma } from "@/lib/prisma"

/** The table (or a column) is not in the database yet: the migration lags behind the deploy. */
export class ComplianceProfileUnavailableError extends Error {
  constructor() {
    super("compliance_profile_unavailable")
  }
}

function isMissingSchema(e: unknown): boolean {
  // P2021 = table does not exist, P2022 = column does not exist.
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")
}

const SELECT = Object.fromEntries(COMPLIANCE_PROFILE_FIELDS.map((f) => [f, true])) as Record<keyof ComplianceProfile, true>

const fromRow = (row: Partial<Record<keyof ComplianceProfile, string | null>> | null): ComplianceProfile => ({
  ...EMPTY_COMPLIANCE_PROFILE,
  ...Object.fromEntries(COMPLIANCE_PROFILE_FIELDS.map((f) => [f, row?.[f] ?? ""])),
})

/** Never throws: a screen that merely PREFILLS from the profile must keep working without it. `available:false` = not migrated yet. */
export async function getComplianceProfile(userId: string): Promise<{ profile: ComplianceProfile; available: boolean }> {
  try {
    const row = await prisma.supplierComplianceProfile.findUnique({ where: { userId }, select: SELECT })
    return { profile: fromRow(row), available: true }
  } catch (e) {
    if (!isMissingSchema(e)) console.error("[compliance-profile] read failed", e instanceof Error ? e.message : e)
    return { profile: { ...EMPTY_COMPLIANCE_PROFILE }, available: false }
  }
}

export async function saveComplianceProfile(userId: string, profile: ComplianceProfile): Promise<ComplianceProfile> {
  // Empty strings are stored as NULL: "not provided".
  const data = Object.fromEntries(COMPLIANCE_PROFILE_FIELDS.map((f) => [f, profile[f].trim() || null])) as Record<
    keyof ComplianceProfile,
    string | null
  >
  try {
    const row = await prisma.supplierComplianceProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: SELECT,
    })
    return fromRow(row)
  } catch (e) {
    if (isMissingSchema(e)) throw new ComplianceProfileUnavailableError()
    throw e
  }
}
