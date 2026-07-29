import { prisma } from "@/lib/prisma"
import {
  resolveBattleContenderPlacement,
  type BattleContenderSide,
} from "@/lib/pulse/battle-contender-shared"
import { pickTwoBattleProducts } from "@/lib/pulse/battle-engine"
import {
  resolveListingLowestPrice30dCents,
} from "@/lib/pulse/battle-price-history"

export type OwnedBattleListing = {
  listingId: string
  productId: string
  sellingPriceCents: number
  title: string
  imageUrl: string | null
}

/** Affiliate-owned listed SKU for Battle contender. */
export async function loadOwnedBattleListing(
  userId: string,
  listingId: string
): Promise<OwnedBattleListing | null> {
  const id = listingId.trim()
  const uid = userId.trim()
  if (!id || !uid) return null

  const row = await prisma.affiliateProduct.findFirst({
    where: {
      id,
      affiliateId: uid,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    select: {
      id: true,
      productId: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: { select: { name: true, images: true, id: true } },
    },
  })
  if (!row) return null

  const images = row.customImages
  let imageUrl: string | null = null
  if (Array.isArray(images)) {
    const u = images.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
    imageUrl = u?.trim() || null
  }
  if (!imageUrl && Array.isArray(row.product.images)) {
    const u = row.product.images.find(
      (x): x is string => typeof x === "string" && Boolean(x.trim())
    )
    imageUrl = u?.trim() || null
  }

  return {
    listingId: row.id,
    productId: row.productId,
    sellingPriceCents: row.sellingPriceCents,
    title: (row.customTitle?.trim() || row.product.name).trim(),
    imageUrl,
  }
}

async function pickOpponentProductId(preferredProductId: string): Promise<string | null> {
  const pair = await pickTwoBattleProducts()
  if (pair) {
    const [x, y] = pair
    if (x.id !== preferredProductId) return x.id
    if (y.id !== preferredProductId) return y.id
  }

  const alt = await prisma.product.findFirst({
    where: {
      active: true,
      isDraft: false,
      id: { not: preferredProductId },
      affiliateProducts: { some: { isListed: true } },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  })
  return alt?.id ?? null
}

export type ApplyBattleContenderResult = {
  battleId: string
  status: string
  side: BattleContenderSide
  productAId: string
  productBId: string
  listingId: string
  productId: string
  sellingPriceCents: number
  priceReferenceCents: number | null
  priceReferenceSource: string
  flashDiscount: number
  unchanged: boolean
}

/**
 * Anchor reseller listing as Battle contender (scheduled|live).
 * Idempotent when the product is already A or B.
 */
export async function applyResellerBattleContender(args: {
  battleId: string
  userId: string
  listingId: string
  role?: string
}): Promise<
  | { ok: true; result: ApplyBattleContenderResult }
  | { ok: false; status: number; error: string }
> {
  const listing = await loadOwnedBattleListing(args.userId, args.listingId)
  if (!listing) {
    return { ok: false, status: 404, error: "Listing introuvable ou non listé" }
  }

  const battle = await prisma.pulseBattle.findUnique({
    where: { id: args.battleId },
    select: {
      id: true,
      status: true,
      productAId: true,
      productBId: true,
      flashDiscount: true,
      totalVoters: true,
      votesA: true,
      votesB: true,
    },
  })
  if (!battle) {
    return { ok: false, status: 404, error: "Battle not found" }
  }
  if (battle.status !== "live" && battle.status !== "scheduled") {
    return {
      ok: false,
      status: 400,
      error: "Le produit Battle ne peut être changé qu’en scheduled ou live",
    }
  }

  const ownA = await prisma.affiliateProduct.findFirst({
    where: {
      productId: battle.productAId,
      affiliateId: args.userId,
      isListed: true,
    },
    select: { id: true },
  })
  const ownB = await prisma.affiliateProduct.findFirst({
    where: {
      productId: battle.productBId,
      affiliateId: args.userId,
      isListed: true,
    },
    select: { id: true },
  })

  const placement = resolveBattleContenderPlacement({
    productAId: battle.productAId,
    productBId: battle.productBId,
    preferredProductId: listing.productId,
    ownsA: Boolean(ownA),
    ownsB: Boolean(ownB),
  })

  let nextA = placement.productAId
  let nextB = placement.productBId

  if (placement.needsOpponent || nextA === nextB) {
    const opponentId = await pickOpponentProductId(listing.productId)
    if (!opponentId) {
      return {
        ok: false,
        status: 503,
        error: "Pas d’adversaire disponible pour le Battle",
      }
    }
    if (placement.side === "B") {
      nextA = opponentId
      nextB = listing.productId
    } else {
      nextA = listing.productId
      nextB = opponentId
    }
  }

  const productsChanged =
    nextA !== battle.productAId || nextB !== battle.productBId

  if (
    productsChanged &&
    battle.status === "live" &&
    (battle.totalVoters > 0 || battle.votesA > 0 || battle.votesB > 0)
  ) {
    return {
      ok: false,
      status: 409,
      error:
        "Battle déjà en cours avec des votes — choisis ton produit sur le prochain battle programmé",
    }
  }

  const ref = await resolveListingLowestPrice30dCents({
    listingId: listing.listingId,
    currentSellingPriceCents: listing.sellingPriceCents,
  })

  const updated = await prisma.pulseBattle.update({
    where: { id: battle.id },
    data: {
      productAId: nextA,
      productBId: nextB,
      ...(productsChanged
        ? {
            votesA: 0,
            votesB: 0,
            totalVoters: 0,
            winnerId: null,
          }
        : {}),
      flashDiscountSetBy: args.userId,
      priceReferenceCents: ref.cents > 0 ? ref.cents : null,
      priceReferenceSource: ref.source,
    },
    select: {
      id: true,
      status: true,
      productAId: true,
      productBId: true,
      flashDiscount: true,
      priceReferenceCents: true,
      priceReferenceSource: true,
    },
  })

  if (productsChanged) {
    await prisma.pulseBattleVote.deleteMany({ where: { battleId: battle.id } }).catch((e) => {
      console.log("[pulse-battle/contender]", {
        result: "vote_reset_failed",
        battleId: battle.id,
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  console.log("[pulse-battle/contender]", {
    result: placement.unchanged && !productsChanged ? "idempotent" : "updated",
    battleId: updated.id,
    userId: args.userId,
    listingId: listing.listingId,
    productId: listing.productId,
    side: placement.side,
    productAId: updated.productAId,
    productBId: updated.productBId,
  })

  return {
    ok: true,
    result: {
      battleId: updated.id,
      status: updated.status,
      side: placement.side,
      productAId: updated.productAId,
      productBId: updated.productBId,
      listingId: listing.listingId,
      productId: listing.productId,
      sellingPriceCents: listing.sellingPriceCents,
      priceReferenceCents: updated.priceReferenceCents,
      priceReferenceSource: updated.priceReferenceSource ?? ref.source,
      flashDiscount: updated.flashDiscount,
      unchanged: placement.unchanged && !productsChanged,
    },
  }
}

/** Build a product pair with reseller SKU as A. */
export async function pickBattlePairWithPreferred(
  preferredProductId: string
): Promise<{ productAId: string; productBId: string } | null> {
  const preferred = preferredProductId.trim()
  if (!preferred) return null

  const exists = await prisma.product.findFirst({
    where: { id: preferred, active: true },
    select: { id: true },
  })
  if (!exists) return null

  const opponentId = await pickOpponentProductId(preferred)
  if (!opponentId) return null
  return { productAId: preferred, productBId: opponentId }
}
