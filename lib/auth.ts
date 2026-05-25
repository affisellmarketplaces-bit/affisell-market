import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import type { Account, Profile } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { cookies } from "next/headers"
import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Apple from "next-auth/providers/apple"
import Credentials from "next-auth/providers/credentials"
import Facebook from "next-auth/providers/facebook"
import Google from "next-auth/providers/google"
import Twitter from "next-auth/providers/twitter"

import {
  AffiliateBlockedOnSupplierPortal,
  EmailIdentifierRequired,
  NonAffiliateOnAffiliatePortal,
  NonSupplierOnSupplierPortal,
  SupplierBlockedOnAffiliatePortal,
} from "@/lib/auth-credentials-errors"
import { inferLoginPortal, isValidEmailIdentifier } from "@/lib/auth-login-portal"
import { verifyBuyerCheckoutMagicToken } from "@/lib/buyer-checkout-magic"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { OAUTH_SIGNUP_INTENT_COOKIE, OAUTH_WELCOME_COOKIE } from "@/lib/oauth-cookies"
import { consumeSupplierInviteTokenCookie } from "@/lib/supplier-invite-cookie"
import { claimSupplierInvitationForUser } from "@/lib/supplier-invitation"
import { prisma } from "@/lib/prisma"

const COOKIE_SAFE = process.env.NODE_ENV === "production"

function env(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v?.length) return v
  }
}

function pickProfileImage(providerId: string, profile: Profile | undefined): string | undefined {
  if (!profile || typeof profile !== "object") return undefined
  const p = profile as Record<string, unknown>
  const direct = typeof p.picture === "string" ? p.picture : undefined
  if (direct) return direct
  if (typeof p.photoURL === "string") return p.photoURL
  if (providerId === "facebook") {
    const pic = p.picture
    if (pic && typeof pic === "object" && typeof (pic as { data?: { url?: unknown } }).data?.url === "string") {
      return (pic as { data: { url: string } }).data.url
    }
  }
  if (typeof p.image_url === "string") return p.image_url
  return typeof p.photo === "string" ? p.photo : undefined
}

async function consumeOAuthSignupIntent(): Promise<string | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(OAUTH_SIGNUP_INTENT_COOKIE)?.value
    jar.delete(OAUTH_SIGNUP_INTENT_COOKIE)
    return raw ?? null
  } catch {
    return null
  }
}

async function setOauthWelcomeCookie(providerId: string) {
  try {
    const jar = await cookies()
    jar.set(OAUTH_WELCOME_COOKIE, providerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SAFE,
      path: "/",
      maxAge: 180,
    })
  } catch {
    /* no request cookies (e.g. edge) */
  }
}

function oauthProviders(): NonNullable<NextAuthConfig["providers"]> {
  const list: NonNullable<NextAuthConfig["providers"]> = []

  const gId = env("GOOGLE_CLIENT_ID")
  const gSec = env("GOOGLE_CLIENT_SECRET")
  if (gId && gSec) {
    list.push(Google({ clientId: gId, clientSecret: gSec, allowDangerousEmailAccountLinking: true }))
  }

  const fId = env("FACEBOOK_CLIENT_ID")
  const fSec = env("FACEBOOK_CLIENT_SECRET")
  if (fId && fSec) {
    list.push(Facebook({ clientId: fId, clientSecret: fSec, allowDangerousEmailAccountLinking: true }))
  }

  const appleId = env("APPLE_ID")
  const appleSec = env("APPLE_SECRET")
  if (appleId && appleSec) {
    list.push(Apple({ clientId: appleId, clientSecret: appleSec, allowDangerousEmailAccountLinking: true }))
  }

  const txId = env("TWITTER_CLIENT_ID")
  const txSec = env("TWITTER_CLIENT_SECRET")
  if (txId && txSec) {
    list.push(
      Twitter({
        clientId: txId,
        clientSecret: txSec,
        allowDangerousEmailAccountLinking: true,
        // OAuth 2.0 mode (Twitter types omit this union field in some releases)
        ...( { version: "2.0" } as Record<string, string> ),
        userinfo:
          "https://api.x.com/2/users/me?user.fields=profile_image_url,username,name",
        profile(p) {
          const d = p.data
          const cleanHandle = (d.username ?? d.id)?.toString().replace(/^@+/, "") ?? d.id
          const emailFallback = `x_${cleanHandle}@oauth.affisell.local`
          const emailResolved =
            typeof d.email === "string" && d.email.length > 0 ? d.email.toLowerCase() : emailFallback
          const nameResolved = typeof d.name === "string" && d.name.trim().length > 0 ? d.name.trim() : cleanHandle
          const imageResolved =
            typeof d.profile_image_url === "string" && d.profile_image_url.length > 0 ? d.profile_image_url : undefined
          const result = {
            id: d.id,
            name: nameResolved,
            email: emailResolved,
            image: imageResolved,
            twitterUsername: cleanHandle,
          }
          return result as typeof result & Profile
        },
      })
    )
  }

  return list
}

/** Auth secret: set `AUTH_SECRET` or `NEXTAUTH_SECRET` in `.env.local` (both supported). */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env("AUTH_SECRET", "NEXTAUTH_SECRET"),
  trustHost: true,
  /** Creates `User` + `Account` on first OAuth sign-in (see Prisma models). */
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    Credentials({
      credentials: { email: {}, password: {}, callbackUrl: {}, checkoutMagic: {} },
      async authorize(c) {
        const magicRaw = c?.checkoutMagic?.toString().trim()
        if (magicRaw) {
          const payload = verifyBuyerCheckoutMagicToken(magicRaw)
          if (!payload) return null
          const userRow = await prisma.user.findUnique({ where: { id: payload.userId } })
          if (!userRow || userRow.role !== "CUSTOMER") return null
          return {
            id: userRow.id,
            email: userRow.email,
            name: userRow.name ?? undefined,
            image: userRow.image ?? undefined,
            role: userRow.role,
          }
        }

        const emailRaw = c?.email?.toString().toLowerCase().trim()
        const passwordRaw = c?.password?.toString()
        if (!emailRaw || !passwordRaw) return null
        if (!isValidEmailIdentifier(emailRaw)) {
          throw new EmailIdentifierRequired()
        }
        const userRow = await prisma.user.findUnique({ where: { email: emailRaw } })
        if (!userRow?.password) return null
        const ok = await bcrypt.compare(passwordRaw, userRow.password)
        if (!ok) return null

        const portal = inferLoginPortal(c?.callbackUrl?.toString())
        if (portal === "AFFILIATE") {
          if (userRow.role === "SUPPLIER") throw new SupplierBlockedOnAffiliatePortal()
          if (userRow.role !== "AFFILIATE") throw new NonAffiliateOnAffiliatePortal()
        } else if (portal === "SUPPLIER") {
          if (userRow.role === "AFFILIATE") throw new AffiliateBlockedOnSupplierPortal()
          if (userRow.role !== "SUPPLIER") throw new NonSupplierOnSupplierPortal()
        }

        return {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name ?? undefined,
          image: userRow.image ?? undefined,
          role: userRow.role,
        }
      },
    }),
    ...oauthProviders(),
  ],

  callbacks: {
    async signIn(params) {
      const { user, account, profile } = params as {
        user?: { id?: string; email?: string | null; image?: string | null; name?: string | null }
        account?: Account | null
        profile?: Profile
      }

      if (account?.provider && account.provider !== "credentials") {
        await setOauthWelcomeCookie(account.provider)
      }

      if (!user && !account) return false

      const isOAuth = Boolean(account?.provider && account.provider !== "credentials")

      if (isOAuth) {
        const userId = user?.id?.toString()
        if (!userId || !user) {
          return true
        }

        try {
          const imageCandidate =
            typeof user.image === "string" && user.image.length
              ? user.image
              : pickProfileImage(account?.provider ?? "", profile)

          let emailVerified: Date | undefined
          if (profile && typeof profile === "object") {
            const pv = (profile as { email_verified?: boolean }).email_verified
            if (pv === true) emailVerified = new Date()
            const xv = (profile as { verified?: boolean }).verified
            if (xv === true) emailVerified = new Date()
          }

          await prisma.user.update({
            where: { id: userId },
            data: {
              name:
                typeof user.name === "string" && user.name.trim().length > 0
                  ? user.name.trim().slice(0, 160)
                  : undefined,
              image: imageCandidate ?? undefined,
              ...(emailVerified ? { emailVerified } : {}),
            },
          })

          const store = await prisma.store.findUnique({ where: { userId } })
          if (store && account?.provider === "facebook" && profile && typeof profile === "object") {
            const fid = String((profile as { id?: unknown }).id ?? "")
            const linkRaw = (profile as { link?: string }).link
            const link =
              typeof linkRaw === "string"
                ? linkRaw
                : fid
                  ? `https://www.facebook.com/profile.php?id=${encodeURIComponent(fid)}`
                  : undefined
            if (link?.length && (!store.facebook || store.facebook.includes("facebook.com"))) {
              await prisma.store.update({ where: { id: store.id }, data: { facebook: link } })
            }
          }

          if (store && account?.provider === "twitter" && profile && typeof profile === "object") {
            const pu = profile as {
              twitterUsername?: string
              username?: string
              data?: { username?: string }
            }
            const h = (pu.twitterUsername ?? pu.data?.username ?? pu.username)?.toString().replace(/^@+/, "").trim()
            if (h?.length) await prisma.store.update({ where: { id: store.id }, data: { twitter: h } })
          }
        } catch (e) {
          console.error("[auth signIn oauth]", e)
        }

        return true
      }

      return true
    },

    async jwt({ token, user }) {
      if (!user?.id) return token as JWT

      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, image: true, name: true, email: true },
      })
      token.id = user.id
      token.role = row?.role ?? (user as { role?: string }).role ?? "CUSTOMER"
      token.email = row?.email ?? user.email ?? token.email
      token.picture =
        typeof row?.image === "string" ? row.image : typeof user.image === "string" ? user.image : (token.picture as string | undefined)
      token.name = typeof row?.name === "string" ? row.name : typeof user.name === "string" ? user.name : (token.name as string | undefined)
      return token as JWT
    },

    async session({ session, token }) {
      if (!session.user) return session
      const id = typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : undefined
      if (id) session.user.id = id
      session.user.role = typeof token.role === "string" ? token.role : session.user.role
      session.user.image = typeof token.picture === "string" ? token.picture : session.user.image ?? undefined
      session.user.name =
        typeof token.name === "string"
          ? token.name
          : typeof session.user.name === "string"
            ? session.user.name
            : undefined
      session.user.email =
        typeof token.email === "string" ? token.email : (session.user.email ?? null)

      return session
    },
  },

  events: {
    async createUser({ user }) {
      let role = "CUSTOMER"
      const intent = await consumeOAuthSignupIntent()
      if (intent === "AFFILIATE" || intent === "SUPPLIER") role = intent

      await prisma.user.update({
        where: { id: user.id! },
        data: { role },
      })

      const u = await prisma.user.findUnique({
        where: { id: user.id! },
        select: { id: true, email: true, name: true, role: true },
      })
      if ((u?.role === "AFFILIATE" || u?.role === "SUPPLIER") && u.email) {
        await ensureMerchantStore({ userId: u.id, email: u.email, displayName: u.name })
      }

      if (u?.role === "SUPPLIER") {
        const inviteToken = await consumeSupplierInviteTokenCookie()
        if (inviteToken) {
          await claimSupplierInvitationForUser(inviteToken, u.id).catch((e) => {
            console.error("[auth] supplier invite claim failed", e)
          })
        }
      }
    },
  },
})
