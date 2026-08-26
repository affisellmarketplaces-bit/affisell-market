import type { ReactNode } from "react"

import { AdminNav } from "@/components/admin/admin-nav"
import type { AdminNavSession } from "@/lib/admin/admin-nav-session"

type Props = {
  session: AdminNavSession
  children: ReactNode
}

/** Shared admin chrome — session from server auth(), never useSession() in nav. */
export function AdminLayoutChrome({ session, children }: Props) {
  return (
    <>
      <AdminNav session={session} />
      {children}
    </>
  )
}
