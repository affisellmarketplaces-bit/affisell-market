export type BuyerSessionSnapshot = {
  userId: string | null
  role: string | null
  isCustomerBuyer: boolean
}

export async function fetchBuyerSessionSnapshot(): Promise<BuyerSessionSnapshot> {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) {
      return { userId: null, role: null, isCustomerBuyer: false }
    }
    const data = (await res.json().catch(() => null)) as {
      user?: { id?: string; role?: string | null } | null
    } | null
    const userId = data?.user?.id?.trim() || null
    const role = data?.user?.role?.trim() || null
    return {
      userId,
      role,
      isCustomerBuyer: Boolean(userId && role === "CUSTOMER"),
    }
  } catch {
    return { userId: null, role: null, isCustomerBuyer: false }
  }
}
