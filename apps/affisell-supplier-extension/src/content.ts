/** Badge on supported product pages */
import { detectPlatform } from "./platform.js"

function updateBadge() {
  const platform = detectPlatform(window.location.href)
  const supported = platform !== "unsupported"
  void chrome.runtime.sendMessage({
    type: "AFFISELL_PAGE_INFO",
    url: window.location.href,
    platform,
    supported,
  }).catch(() => {})
}

updateBadge()
