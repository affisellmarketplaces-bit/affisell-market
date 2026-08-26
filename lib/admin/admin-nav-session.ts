/** Minimal session slice for admin nav — server-passed, no client useSession(). */
export type AdminNavSessionUser = {
  id: string
  name?: string | null
  email?: string | null
}

export type AdminNavSession = {
  user: AdminNavSessionUser
}

export function adminNavSessionFromAuth(
  session: { user?: { id?: string; name?: string | null; email?: string | null } } | null | undefined
): AdminNavSession | null {
  const id = session?.user?.id?.trim()
  if (!id) return null
  return {
    user: {
      id,
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
    },
  }
}
