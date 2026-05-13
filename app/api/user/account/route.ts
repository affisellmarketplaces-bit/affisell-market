import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { deleteMerchantUser } from "@/lib/delete-merchant-account"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE() {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "Only supplier or affiliate accounts can be deleted here." }, { status: 403 })
  }

  try {
    const result = await deleteMerchantUser(userId, role)
    if (!result.ok) {
      if (result.code === "HAS_ORDERS") {
        return NextResponse.json(
          {
            error:
              "This account has marketplace orders and cannot be deleted automatically. Contact support if you need your data removed.",
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Account could not be deleted." }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/user/account]", e)
    return NextResponse.json(
      { error: "Deletion failed. Try again or contact support if the problem persists." },
      { status: 500 }
    )
  }
}
