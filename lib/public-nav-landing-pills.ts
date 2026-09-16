/**
 * Landing `/` chrome — keep primary pills lean (trust / discovery).
 * Full browse pills (Battles, Magic Lab, Trusted stores) stay on other routes.
 */
export type PublicNavLandingPillsOptions = {
  landingPills: boolean
  showMagicLab: boolean
}

export type PublicNavBrowsePillVisibility = {
  showBattles: boolean
  showMagicLab: boolean
  showTrustedStores: boolean
}

export function resolvePublicNavBrowsePillVisibility({
  landingPills,
  showMagicLab,
}: PublicNavLandingPillsOptions): PublicNavBrowsePillVisibility {
  if (landingPills) {
    return {
      showBattles: false,
      showMagicLab: false,
      showTrustedStores: false,
    }
  }
  return {
    showBattles: true,
    showMagicLab,
    showTrustedStores: true,
  }
}
