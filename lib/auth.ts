import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(c) {
        const emailRaw = c?.email
        const email =
          typeof emailRaw === "string"
            ? emailRaw.toLowerCase().trim()
            : String(emailRaw ?? "")
              .toLowerCase()
              .trim()
        if (!email || typeof c?.password !== "string") return null

        const u = await prisma.user.findUnique({ where: { email } })
        if (!u?.password) return null

        return (await bcrypt.compare(c.password, u.password))
          ? { id: u.id, email: u.email, role: u.role }
          : null
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : ""
        const r = token.role
        if (r === "SUPPLIER" || r === "AFFILIATE" || r === "ADMIN") {
          session.user.role = r
        }
      }
      return session
    },
  },
})
