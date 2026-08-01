/**
 * Idempotent seed for LÉGION demo profiles @nelson / @sarah.
 * Usage: npx tsx scripts/legion-ensure-demo-profiles.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function ensureUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({
    data: {
      email,
      name,
      role: "AFFILIATE",
    },
  })
}

async function ensureProfile(args: {
  userId: string
  username: string
  displayName: string
  bio: string
}) {
  const byUser = await prisma.storeProfile.findUnique({ where: { userId: args.userId } })
  if (byUser) {
    if (byUser.username !== args.username) {
      const taken = await prisma.storeProfile.findUnique({ where: { username: args.username } })
      if (!taken) {
        return prisma.storeProfile.update({
          where: { id: byUser.id },
          data: {
            username: args.username,
            displayName: args.displayName,
            bio: args.bio,
            isActive: true,
          },
        })
      }
    }
    return prisma.storeProfile.update({
      where: { id: byUser.id },
      data: { displayName: args.displayName, bio: args.bio, isActive: true },
    })
  }

  const byName = await prisma.storeProfile.findUnique({ where: { username: args.username } })
  if (byName) return byName

  return prisma.storeProfile.create({
    data: {
      userId: args.userId,
      username: args.username,
      displayName: args.displayName,
      bio: args.bio,
      isActive: true,
    },
  })
}

async function main() {
  const nelsonUser = await ensureUser("nelson@legion.affisell.com", "Nelson")
  const sarahUser = await ensureUser("sarah@legion.affisell.com", "Sarah")

  const nelson = await ensureProfile({
    userId: nelsonUser.id,
    username: "nelson",
    displayName: "Nelson",
    bio: "Fondateur Affisell — Légion semaine 1.",
  })
  const sarah = await ensureProfile({
    userId: sarahUser.id,
    username: "sarah",
    displayName: "Sarah",
    bio: "Filleul Légion — boutique test.",
  })

  console.log("[legion]", {
    result: "demo_profiles_ok",
    nelson: nelson.username,
    sarah: sarah.username,
  })
}

main()
  .catch((err) => {
    console.error("[legion]", { result: "demo_profiles_failed", err })
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
