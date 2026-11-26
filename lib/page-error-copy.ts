/**
 * Copy for the segment error boundary (`app/error.tsx`).
 *
 * The boundary ships with every page, so it must not import `messages/*.json`: it used to import the full EN and FR
 * catalogs (~860 KB of JSON) to read five strings. The values mirror `errors.page` in messages/en.json and fr.json —
 * `lib/__tests__/page-error-copy.test.ts` fails if they drift.
 */
export type PageErrorCopy = {
  label: string
  title: string
  body: string
  retry: string
  home: string
}

export const PAGE_ERROR_COPY: Record<"en" | "fr", PageErrorCopy> = {
  en: {
    label: "Something went wrong",
    title: "We hit a snag",
    body: "A problem occurred while loading this page. You can retry, or go back to the home page.",
    retry: "Try again",
    home: "Home",
  },
  fr: {
    label: "Une erreur est survenue",
    title: "Un problème est survenu",
    body: "Le chargement de la page a échoué. Réessayez ou revenez à l'accueil.",
    retry: "Réessayer",
    home: "Accueil",
  },
}
