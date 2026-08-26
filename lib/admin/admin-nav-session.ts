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
  const user = session?.user
  const id = user?.id?.trim()
  if (!id || !user) return null
  return {
    user: {
      id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
  }
}
