export type AliExpressEnvConfig = {
  appKey: string
  appSecret: string
  accessToken: string
  refreshToken: string
  sandbox: boolean
}

const ENV_ALIASES = {
  appKey: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_KEY"],
  appSecret: ["ALIEXPRESS_APP_SECRET", "ALIEXPRESS_SECRET", "ALIEXPRESS_APPSECRET"],
  accessToken: [
    "ALIEXPRESS_ACCESS_TOKEN",
    "ALIEXPRESS_TOKEN",
    "ALIEXPRESS_SESSION",
    "ALIEXPRESS_SESSION_KEY",
  ],
  refreshToken: ["ALIEXPRESS_REFRESH_TOKEN"],
} as const

function readFirstEnv(keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ""
}

export function readAliExpressConfig(): AliExpressEnvConfig {
  const env = process.env.ALIEXPRESS_ENV?.trim().toLowerCase()
  return {
    appKey: readFirstEnv(ENV_ALIASES.appKey),
    appSecret: readFirstEnv(ENV_ALIASES.appSecret),
    accessToken: readFirstEnv(ENV_ALIASES.accessToken),
    refreshToken: readFirstEnv(ENV_ALIASES.refreshToken),
    sandbox: env !== "production",
  }
}

export type AliExpressConfigStatus = {
  configured: boolean
  missing: string[]
  /** Human-readable hint for suppliers / ops (no secrets). */
  message: string
}

export function getAliExpressConfigStatus(
  config: AliExpressEnvConfig = readAliExpressConfig()
): AliExpressConfigStatus {
  const missing: string[] = []
  if (!config.appKey) missing.push("ALIEXPRESS_APP_KEY")
  if (!config.appSecret) missing.push("ALIEXPRESS_APP_SECRET")
  if (!config.accessToken && !config.refreshToken) {
    missing.push("ALIEXPRESS_ACCESS_TOKEN (ou ALIEXPRESS_REFRESH_TOKEN)")
  }

  const configured =
    Boolean(config.appKey && config.appSecret) &&
    Boolean(config.accessToken || config.refreshToken)

  const message = configured
    ? "OK"
    : missing.length > 0
      ? `Variables manquantes sur le serveur : ${missing.join(", ")}. Ajoutez-les dans Vercel → Settings → Environment Variables, puis redéployez.`
      : "AliExpress API is not configured"

  return { configured, missing, message }
}
