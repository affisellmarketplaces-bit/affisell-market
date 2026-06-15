import { prisma } from "@/lib/prisma"

/** Founder / admin inbox for expansion ops emails (digest + instant graduation alerts). */
export async function resolveExpansionAdminEmail(): Promise<string | null> {
  const fromEnv = process.env.ADMIN_EXPANSION_DIGEST_EMAIL?.trim()
  if (fromEnv) return fromEnv
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  })
  return admin?.email ?? null
}
