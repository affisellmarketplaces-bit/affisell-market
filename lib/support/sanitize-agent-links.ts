/** Strip dev origins from assistant output — buyers must never see localhost. */

const LOCAL_ORIGIN_RE = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/gi

export function sanitizeSupportAgentText(text: string): string {
  return text
    .replace(LOCAL_ORIGIN_RE, "")
    .replace(/\bBASE\//g, "/")
    .replace(/  +/g, " ")
    .trim()
}
