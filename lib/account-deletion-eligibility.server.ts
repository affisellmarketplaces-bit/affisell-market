import type {
  AccountDeletionBlockCode,
  AccountDeletionImpactScope,
  AccountDeletionPreview,
} from "@/lib/account-deletion-shared"
import { prisma } from "@/lib/prisma"

function roleLabel(role: string): string {
  switch (role) {
    case "SUPPLIER":
      return "supplier"
    case "AFFILIATE":
      return "affiliate"
    case "CUSTOMER":
      return "buyer"
    default:
      return "account"
  }
}

function merchantImpactScope(role: "SUPPLIER" | "AFFILIATE"): AccountDeletionImpactScope {
  return role === "SUPPLIER" ? "supplier" : "affiliate"
}

export async function getAccountDeletionPreview(userId: string): Promise<AccountDeletionPreview | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user?.email) return null

  const label = roleLabel(user.role)

  if (user.role === "SUPPLIER" || user.role === "AFFILIATE") {
    const orderWhere =
      user.role === "AFFILIATE" ? { affiliateId: userId } : { supplierId: userId }
    const orderCount = await prisma.order.count({ where: orderWhere })
    const blockCode: AccountDeletionBlockCode | undefined =
      orderCount > 0 ? "HAS_ORDERS" : undefined

    return {
      email: user.email,
      role: user.role,
      roleLabel: label,
      canDelete: orderCount === 0,
      blockCode,
      impactScope: merchantImpactScope(user.role),
    }
  }

  const openOrders = await prisma.order.count({
    where: {
      buyerUserId: userId,
      status: { in: ["paid", "preparing", "shipped"] },
    },
  })
  const blockCode: AccountDeletionBlockCode | undefined =
    openOrders > 0 ? "OPEN_BUYER_ORDERS" : undefined

  return {
    email: user.email,
    role: user.role,
    roleLabel: label,
    canDelete: openOrders === 0,
    blockCode,
    impactScope: "buyer" satisfies AccountDeletionImpactScope,
  }
}
