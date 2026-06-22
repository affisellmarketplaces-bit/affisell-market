import "server-only"

type PlusUser = {
  role?: string | null
  isPro?: boolean | null
  stripeSubscriptionId?: string | null
}

/** Affisell+ buyers get unlimited try-on (maps to `User.isPro` + active subscription). */
export function isAffisellPlusUser(user: PlusUser | null | undefined): boolean {
  if (!user) return false
  const role = String(user.role ?? "").toUpperCase()
  if (role !== "CUSTOMER" && role !== "") return false
  if (user.isPro) return true
  return Boolean(user.stripeSubscriptionId?.trim())
}
