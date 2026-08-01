import "server-only"

import { prisma } from "@/lib/prisma"
import {
  isValidLegionUsername,
  normalizeLegionUsername,
} from "@/lib/legion/username"

/**
 * Idempotent: ensure a StoreProfile exists for a merchant user.
 * Prefer Store.slug when valid; otherwise derive from username hint.
 */
export async function ensureStoreProfile(args: {
  userId: string
  usernameHint?: string | null
  displayName?: string | null
  bio?: string | null
  avatarUrl?: string | null
  tiktokUrl?: string | null
  instagramUrl?: string | null
}) {
  const existing = await prisma.storeProfile.findUnique({
    where: { userId: args.userId },
  })
  if (existing) return existing

  const store = await prisma.store.findUnique({
    where: { userId: args.userId },
    select: {
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      aiAvatarUrl: true,
      tiktok: true,
      instagram: true,
    },
  })

  const candidates = [
    args.usernameHint,
    store?.slug,
    `u_${args.userId.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
  ]
    .map((c) => (c ? normalizeLegionUsername(c) : ""))
    .filter(Boolean)

  let username: string | null = null
  for (const c of candidates) {
    if (!isValidLegionUsername(c)) continue
    const taken = await prisma.storeProfile.findUnique({ where: { username: c } })
    if (!taken) {
      username = c
      break
    }
  }
  if (!username) {
    username = `u${Date.now().toString(36).slice(-8)}`
  }

  return prisma.storeProfile.create({
    data: {
      userId: args.userId,
      username,
      displayName: args.displayName ?? store?.name ?? username,
      bio: args.bio ?? store?.description ?? null,
      avatarUrl: args.avatarUrl ?? store?.aiAvatarUrl ?? store?.logoUrl ?? null,
      tiktokUrl: args.tiktokUrl ?? store?.tiktok ?? null,
      instagramUrl: args.instagramUrl ?? store?.instagram ?? null,
      isActive: true,
    },
  })
}
