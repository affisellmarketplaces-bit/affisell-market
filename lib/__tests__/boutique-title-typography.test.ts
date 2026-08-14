import { describe, expect, it } from "vitest"

import {
  buildBoutiqueTitleSegments,
  DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  inferBoutiqueTitleTypographyFromVibe,
  parseBoutiqueTitleTypography,
  sanitizeBoutiqueTitleDisplay,
} from "@/lib/boutique/boutique-title-typography-shared"

describe("boutique-title-typography-shared", () => {
  it("parses storefront theme fields", () => {
    const parsed = parseBoutiqueTitleTypography({
      boutiqueTitleFont: "orbitron",
      boutiqueTitleOrnament: "sparkle",
      boutiqueTitleLayout: "boutique-accent",
      boutiqueTitleDisplay: "✦ Test ✦",
    })
    expect(parsed.fontId).toBe("orbitron")
    expect(parsed.ornamentId).toBe("sparkle")
    expect(parsed.displayOverride).toBe("✦ Test ✦")
  })

  it("strips unsafe characters from custom display", () => {
    expect(sanitizeBoutiqueTitleDisplay("<script>alert</script>")).toBe("scriptalertscript")
    expect(sanitizeBoutiqueTitleDisplay("✦ Ecom · Store ✦")).toBe("✦ Ecom · Store ✦")
  })

  it("builds boutique-accent segments with sparkle ornament", () => {
    const { segments, ariaLabel } = buildBoutiqueTitleSegments({
      storeLabel: "Ecom Store",
      typography: {
        ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
        ornamentId: "sparkle",
      },
    })
    expect(segments).toHaveLength(2)
    expect(segments[1]?.text).toBe("✦ Ecom Store ✦")
    expect(ariaLabel).toBe("Boutique Ecom Store")
  })

  it("infers orbitron for gaming vibe", () => {
    const inferred = inferBoutiqueTitleTypographyFromVibe({
      vibe: "neon cyber gaming store",
    })
    expect(inferred.fontId).toBe("orbitron")
    expect(inferred.ornamentId).toBe("sparkle")
  })

  it("uses custom-only layout for display override", () => {
    const { segments } = buildBoutiqueTitleSegments({
      storeLabel: "Ecom Store",
      typography: {
        ...DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
        layoutId: "custom-only",
        displayOverride: "✦ Ecom · Store ✦",
      },
    })
    expect(segments).toHaveLength(1)
    expect(segments[0]?.text).toBe("✦ Ecom · Store ✦")
  })
})
