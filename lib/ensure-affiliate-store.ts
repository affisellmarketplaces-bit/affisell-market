import { prisma } from "@/lib/prisma"

function slugBaseFromEmail(email: string): string {
  const local = (email.split("@")[0] || "boutique").toLowerCase()
  const slug = local.replace(/[^a-z0-9]+/g, "").slice(0, 48)
  return slug || "boutique"
}

export async function ensureAffiliateStore(userId: string, email: string) {
  const existing = await prisma.affiliateStore.findUnique({ where: { userId } })
  if (existing) return existing

  let base = slugBaseFromEmail(email)
  let slug = base
  let n = 0
  while (await prisma.affiliateStore.findUnique({ where: { slug } })) {
    n += 1
    slug = `${base}${n}`.slice(0, 60)
  }

  return prisma.affiliateStore.create({
    data: { userId, slug },
  })
}
