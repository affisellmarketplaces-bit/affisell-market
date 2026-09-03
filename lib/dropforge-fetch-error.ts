/** Client-safe DropForge fetch error copy (no Prisma). */

export function dropforgeHttpErrorMessage(
  res: Response,
  data: Record<string, unknown>,
  locale: "fr" | "en" = "fr"
): string {
  const err = typeof data.error === "string" ? data.error.trim() : ""
  if (err) return err

  const isEmpty = Object.keys(data).length === 0
  const contentType = res.headers.get("content-type") ?? ""
  const looksNonJson = isEmpty || !contentType.includes("json")

  if (looksNonJson && !res.ok) {
    if (res.status === 403) {
      return locale === "en"
        ? "Request blocked — refresh the page and try again."
        : "Requête bloquée — rechargez la page et réessayez."
    }
    if (res.status === 404) {
      return locale === "en"
        ? "DropForge API not found — deployment may still be in progress."
        : "API DropForge introuvable — déploiement en cours ?"
    }
    if (res.status === 401) {
      return locale === "en"
        ? "Sign in as a supplier to continue."
        : "Connectez-vous en tant que fournisseur pour continuer."
    }
    if (res.status === 429) {
      return locale === "en"
        ? "Too many requests — wait a minute."
        : "Trop de requêtes — patientez une minute."
    }
    if (res.status >= 502) {
      return locale === "en"
        ? "Server timeout — try again with a shorter instruction."
        : "Le serveur met trop de temps — instruction plus courte ou réessayez."
    }
    return locale === "en"
      ? "Invalid server response — try again in a few seconds."
      : "Réponse serveur invalide — réessayez dans quelques secondes."
  }

  return locale === "en" ? "DropForge unavailable" : "DropForge indisponible"
}
