/** Resolve which buyer account should receive order status push (prefer logged-in buyer). */
export function resolveOrderPushTarget(args: {
  buyerUserId?: string | null
  customerEmail?: string | null
}): { kind: "user_id"; userId: string } | { kind: "email"; email: string } | { kind: "none" } {
  const userId = args.buyerUserId?.trim()
  if (userId) {
    return { kind: "user_id", userId }
  }

  const email = args.customerEmail?.trim().toLowerCase()
  if (email) {
    return { kind: "email", email }
  }

  return { kind: "none" }
}
