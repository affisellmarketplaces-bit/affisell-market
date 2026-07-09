import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role?: string
      /** Profile image URL (JWT / OAuth synced). */
      image?: string | null
      email?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    email?: string
    cguVersion?: string | null
    legalGateHash?: string | null
  }
}
