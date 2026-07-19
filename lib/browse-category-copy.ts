/** Static browse copy — avoids next-intl request APIs (DYNAMIC_SERVER_USAGE + latency). */

export function browseProduitsLabel(count: number, locale: "fr" | "en" = "fr"): string {
  if (locale === "en") {
    return count === 1 ? "1 product" : `${count} products`
  }
  return count === 1 ? "1 produit" : `${count} produits`
}

export function browseCategoryCopy(locale: "fr" | "en" = "fr") {
  if (locale === "en") {
    return {
      breadcrumbHome: "Home",
      subcategories: "Subcategories",
      seeAll: "Browse full catalog",
      empty: "No products yet.",
      metaTitle: (category: string) => `${category} — Shop on Affisell`,
      metaDescription: (category: string, count: number) =>
        `Discover ${browseProduitsLabel(count, "en")} in ${category} on Affisell.`,
      listingCount: (count: number) => browseProduitsLabel(count, "en"),
    }
  }

  return {
    breadcrumbHome: "Accueil",
    subcategories: "Sous-catégories",
    seeAll: "Voir tout le catalogue",
    empty: "Aucun produit pour le moment.",
    metaTitle: (category: string) => `${category} — Acheter sur Affisell`,
    metaDescription: (category: string, count: number) =>
      `Découvrez ${browseProduitsLabel(count, "fr")} en ${category} sur Affisell.`,
    listingCount: (count: number) => browseProduitsLabel(count, "fr"),
  }
}
