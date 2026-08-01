/** Client-safe Affisell Command Brief storage (first-run coaches). */

export function coachStorageKey(surface: string, version = "v1"): string {
  return `affisell.coach.${surface}.${version}`
}

export function readCoachDismissed(surface: string, version = "v1"): boolean {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(coachStorageKey(surface, version)) === "1"
  } catch {
    return false
  }
}

export function writeCoachDismissed(surface: string, version = "v1"): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(coachStorageKey(surface, version), "1")
  } catch {
    /* private mode */
  }
}
