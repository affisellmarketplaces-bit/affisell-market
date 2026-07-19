/** User-facing copy for TikTok Shop OAuth failures on /radar/connect. */

export type TikTokConnectErrorCopy = {
  title: string
  body: string
  steps: string[]
}

/**
 * Map OAuth / Partner error codes to actionable FR guidance.
 * "Aucune boutique disponible" on seller-fr with is_draft=true is Partner draft
 * whitelist — not an Affisell bug.
 */
export function resolveTikTokConnectError(error: string | null): TikTokConnectErrorCopy | null {
  if (!error?.trim()) return null
  const key = error.trim().toLowerCase()

  if (
    key === "no_shop" ||
    key === "no_shop_available" ||
    key.includes("no_available_shop") ||
    key.includes("shop_not_available") ||
    key === "access_denied"
  ) {
    return {
      title: "TikTok : aucune boutique disponible (app draft)",
      body: "L’app Affisell Analytics Connector est encore en brouillon (is_draft=true). TikTok n’autorise que les shops whitelistés en Partner Center — même si ta boutique FR existe déjà.",
      steps: [
        "Ouvre Partner Center → ton app → Test / Authorized shops",
        "Ajoute le seller ID / shop de DesyStore (FR) comme boutique de test",
        "Reconnecte-toi avec le compte admin Seller Center FR (pas un staff limité)",
        "Ou soumets l’app en review / publish pour autoriser tous les shops du marché",
      ],
    }
  }

  if (key === "redis_not_configured") {
    return {
      title: "Redis requis pour OAuth TikTok",
      body: "RADAR_ENABLED=true exige REDIS_URL (state CSRF multi-instance).",
      steps: ["Ajoute REDIS_URL sur Vercel / .env.local", "Relance Connecter TikTok Shop"],
    }
  }

  if (key === "oauth_start") {
    return {
      title: "Impossible de démarrer OAuth TikTok",
      body: "Credentials Partner manquants ou invalides (APP_ID / APP_KEY / SECRET).",
      steps: [
        "Vérifie TIKTOK_SHOP_APP_ID, TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET",
        "Redirect URI exacte : /api/intelli/tiktok/callback",
      ],
    }
  }

  return {
    title: "Connexion TikTok échouée",
    body: `Code retourné : ${error}`,
    steps: [
      "Réessaie depuis /radar/connect",
      "Si l’écran Seller dit « Aucune boutique disponible », whitelist le shop en Partner Center (app draft)",
    ],
  }
}
