export const DEFAULT_API_BASE = "http://localhost:3001"

export type ExtensionSettings = {
  apiBase: string
  token: string
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.sync.get(["apiBase", "token"])
  return {
    apiBase:
      typeof data.apiBase === "string" && data.apiBase.trim()
        ? data.apiBase.trim().replace(/\/$/, "")
        : DEFAULT_API_BASE,
    token: typeof data.token === "string" ? data.token.trim() : "",
  }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({
    apiBase: settings.apiBase.replace(/\/$/, ""),
    token: settings.token.trim(),
  })
}
