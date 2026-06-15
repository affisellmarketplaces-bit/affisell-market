import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Context for supplier UI after accepting an affiliate invite. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const invitation = await prisma.affiliateSupplierInvitation.findUnique({
      where: { supplierId: session.user.id },
      include: {
        affiliate: {
          select: {
            name: true,
            store: { select: { name: true, slug: true, logoUrl: true } },
          },
        },
      },
    })

    if (!invitation) {
      return Response.json({ invitation: null })
    }

    const store = invitation.affiliate.store
    return Response.json({
      invitation: {
        status: invitation.status,
        offeredCommissionPct: invitation.offeredCommissionPct,
        categoryHint: invitation.categoryHint,
        affiliateName:
          store?.name?.trim() || invitation.affiliate.name?.trim() || "Créateur Affisell",
        affiliateSlug: store?.slug ?? null,
        affiliateLogoUrl: store?.logoUrl ?? null,
        catalogLive: invitation.status === "CATALOG_LIVE",
      },
    })
  } catch (error) {
    console.error("[supplier-invitation-context]", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ invitation: null }, { status: 200 })
  }
}
