import { auth } from "@/auth"

export async function requireAdminSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, status: 401, error: "unauthorized" }
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "forbidden" }
  }
  return { ok: true as const, session }
}
