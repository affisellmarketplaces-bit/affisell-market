/** Strip dev origins from assistant output — buyers must never see localhost. */

import { publicAbsoluteUrl } from "@/lib/public-app-url"

export { sanitizePublicLink } from "@/lib/public-app-url"

const LOCAL_ORIGIN_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?(\/[^\s)>"']*)?/gi

export function sanitizeSupportAgentText(text: string): string {
  return text
    .replace(LOCAL_ORIGIN_RE, (_, path: string | undefined) => publicAbsoluteUrl(path || "/"))
    .replace(/\bBASE\//g, "/")
    .replace(/  +/g, " ")
    .trim()
}
