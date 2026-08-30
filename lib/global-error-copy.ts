import type { AppLocale } from "@/lib/i18n-locale"
import { readLocaleFromDocumentCookie } from "@/lib/i18n-read-locale-cookie"

export type GlobalErrorCopy = {
  eyebrow: string
  title: string
  body: string
  ref: string
  retry: string
  home: string
  signOut: string
}

/** Minimal copy for root error UI — no next-intl / CLIENT_MESSAGES (must stay tiny). */
const COPY: Record<"en" | "fr", GlobalErrorCopy> = {
  en: {
    eyebrow: "Error",
    title: "This page could not load",
    body: "Something went wrong on our side. Try again, sign out if you switched accounts, or return home.",
    ref: "Ref. {digest}",
    retry: "Try again",
    home: "Home",
    signOut: "Sign out",
  },
  fr: {
    eyebrow: "Erreur",
    title: "La page n'a pas pu se charger",
    body: "Un problème est survenu côté serveur. Réessayez, déconnectez-vous si vous avez changé de compte, ou revenez à l'accueil.",
    ref: "Réf. {digest}",
    retry: "Réessayer",
    home: "Accueil",
    signOut: "Se déconnecter",
  },
}

export function readGlobalErrorLocale(): AppLocale {
  return readLocaleFromDocumentCookie()
}

export function globalErrorCopy(locale: AppLocale): GlobalErrorCopy {
  return locale === "fr" ? COPY.fr : COPY.en
}
