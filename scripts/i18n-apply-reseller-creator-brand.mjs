#!/usr/bin/env node
/**
 * Apply Affisell brand terminology: "Resellers / Creators" (not creators-only).
 * Run: node scripts/i18n-apply-reseller-creator-brand.mjs && npm run i18n:parity
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

/** @type {Record<string, Record<string, string>>} */
const LOCALE_STRINGS = {
  en: {
    "creators.meta.title": "Sell on Affisell — Reseller & creator storefront",
    "creators.meta.description":
      "Monetize your audience without inventory. Resellers and creators choose products — we fulfill.",
    "creators.hero.badgeCreators": "500+ resellers & creators",
    "creators.social.title": "Resellers & creators growing with Affisell",
    "creators.preview.title": "Your reseller dashboard",
    "partners.meta.description": "Distribute through reseller & creator partner storefronts.",
    "partners.hero.title": "Distribute through 10,000+ resellers & creators",
    "partners.features.reach.description": "Reach engaged audiences via reseller & creator stores",
    "partners.steps.step2": "Resellers & creators list your products",
    "partners.backCreators": "← Resellers / Creators",
    "enterprise.meta.description":
      "Dedicated onboarding, large-catalog import, custom domains, and a reseller & creator network for established brands.",
    "enterprise.hero.title": "Your brand. Your domain. 10,000+ resellers & creators.",
    "enterprise.program.body":
      "Our team configures your account, prioritizes KYC, and connects your catalog before opening the reseller & creator network.",
    "affiliate.referral.description":
      "Invite resellers & creators — 10% of their net earnings on every sale. 5% welcome bonus for referrals under 30 days.",
    "sellPage.creator.title": "2. Reseller / creator partner",
    "sellPage.creator.body":
      "Pick supplier SKUs, set your price, and publish on your storefront — Affisell handles checkout end to end.",
    "sellPage.ctaPartner": "Become a reseller / creator partner",
    "companyPages.stats.stores": "Reseller & creator stores",
    "companyPages.about.metaTitle": "About Affisell — Reseller & creator marketplace",
    "companyPages.about.title": "Commerce infrastructure for resellers & creators",
    "companyPages.about.description":
      "Affisell is a marketplace built for resellers and creators: suppliers list their catalog, partners launch a storefront in minutes, and buyers shop with confidence.",
    "companyPages.about.mission.body":
      "Resellers and creators should monetize their audience without inventory or logistics. Affisell orchestrates the full loop — catalog, secure checkout, supplier fulfillment and GDPR-compliant trust signals.",
    "companyPages.about.values.0.title": "Reseller & creator storefronts",
    "companyPages.about.timeline.items.2024.body":
      "Marketplace launch: supplier catalog and reseller & creator partner storefronts.",
    "companyPages.about.timeline.items.2025a.body":
      "Product discovery and selection tools for reseller & creator partners.",
    "companyPages.about.cta.creators": "Become a reseller / creator",
    "companyPages.blog.metaTitle": "Affisell Blog — Product & reseller economy",
    "companyPages.blog.metaDescription":
      "Marketplace updates, commission transparency and reseller & creator tooling from the Affisell team.",
    "companyPages.blog.description":
      "Product launches, marketplace economics and reseller & creator playbooks — written by the team building Affisell.",
    "companyPages.blog.posts.swipe-feed-affiliate-hub.excerpt":
      "Reseller & creator partners browse the catalog in a mobile flow and publish selections in a few gestures.",
    "companyPages.blog.posts.gdpr-marketplace-trust.sections.s3.body":
      "Resellers and creators operate across the EU. Built-in compliance reassures brand partners and buyers alike.",
    "companyPages.blog.posts.creator-storefront-60s.title": "Launch a reseller storefront in minutes",
    "companyPages.blog.posts.creator-storefront-60s.category": "Resellers / Creators",
    "companyPages.blog.posts.creator-storefront-60s.sections.intro":
      "Affisell removes the ops burden from reseller & creator commerce: no warehouse, no payment setup from scratch.",
    "companyPages.blog.posts.creator-storefront-60s.sections.s3.body":
      "Create a free partner account and publish your first listing. Most resellers & creators see their first sale quickly.",
    "companyPages.careers.metaDescription":
      "Join the team building the reseller & creator marketplace — remote-friendly roles in engineering, partner success and supplier partnerships.",
    "companyPages.careers.title": "Build the reseller & creator economy with us",
    "companyPages.careers.culture.body":
      "Affisell is early-stage with production traffic: you'll ship to real merchants weekly, own outcomes end-to-end, and talk directly to resellers, creators and suppliers.",
    "companyPages.careers.roles.creator-success.title": "Partner Success Manager",
    "companyPages.careers.roles.creator-success.summary":
      "Onboard reseller & creator partners, improve storefront quality and feed product insights back to engineering.",
    "companyPages.careers.roles.creator-success.applySubject": "Application — Partner Success",
    "companyPages.careers.roles.creator-success.requirements.r1":
      "Fluent FR/EN; experience with reseller, creator or e-commerce communities",
    "companyPages.careers.roles.creator-success.requirements.r3":
      "Empathy for resellers & creators balancing audience trust and growth",
    "companyPages.press.metaDescription":
      "Media resources, company facts and press contact for Affisell — the reseller & creator marketplace.",
    "companyPages.press.description":
      "Facts, boilerplate and assets for journalists covering reseller & creator commerce and EU retail tech.",
    "companyPages.press.boilerplate.short":
      "Affisell is a reseller & creator marketplace connecting verified suppliers, partner storefronts and buyers — with built-in EU compliance.",
    "companyPages.press.boilerplate.long":
      "Founded in Marseille, Affisell lets resellers and creators launch branded shops in minutes without inventory. Suppliers distribute through a partner network with automated fulfillment. The platform includes discovery tools, GDPR self-service and transparent order tracking.",
    "luxe.subtitle": "Curated pieces · verified resellers & creators · limited visibility",
    "demoLab.personas.buyer.cardBody": "Shop reseller & creator storefronts end to end.",
    "demoLab.steps.affiliate.discover.body": "Live shopping feed and reseller & creator storefronts.",
    "demoLab.steps.buyer.shop.body": "Reseller shop flow and product pages.",
    "demoLab.storefrontFormats.architectureDiagram":
      "Affiliate merchant\n├── /shops/[slug]     → Brand Studio (buyer chrome, modular sections)\n├── /boutique/[slug]  → Procedural boutique (1024 skins, design studio)\n├── /embed/shops/[slug] → Embeddable widget (Brand Studio toggle)\n└── custom domain CNAME → rewrites to /shops/[slug]\n\nSupplier merchant\n└── /store/supplier/[slug] → Supplier catalog vitrine\n\nReseller / Creator (Légion)\n└── /u/[username] → @handle vitrine (parallel to Store slug)",
    "demoLab.storefrontFormats.audiences.creator": "Reseller / Creator",
    "demoLab.storefrontFormats.formats.legion-profile.role":
      "Reseller / creator handle vitrine (@username). Parallel identity to Store slug — optimized for social traffic and Légion referrals.",
    "demoLab.storefrontFormats.links.shopsBrowse": "Browse reseller & creator shops",
    "emails.passwordReset.portalAffiliate": "Reseller space",
  },
  fr: {
    "creators.meta.title": "Vendre sur Affisell — Boutique revendeur / créateur",
    "creators.meta.description":
      "Monétisez votre audience sans stock. Revendeurs et créateurs choisissent — nous livrons.",
    "creators.hero.badgeCreators": "500+ revendeurs & créateurs",
    "creators.social.title": "Des revendeurs & créateurs qui grandissent avec Affisell",
    "creators.preview.title": "Votre tableau de bord revendeur",
    "partners.meta.description": "Distribuez via les vitrines partenaires revendeurs & créateurs.",
    "partners.hero.title": "Distribuez via 10 000+ revendeurs & créateurs",
    "partners.features.reach.description":
      "Accédez à des audiences engagées via boutiques revendeurs & créateurs",
    "partners.steps.step2": "Les revendeurs & créateurs listent vos produits",
    "partners.backCreators": "← Revendeurs / Créateurs",
    "enterprise.meta.description":
      "Onboarding dédié, catalogue à grande échelle, domaine custom et réseau revendeurs & créateurs pour les marques établies.",
    "enterprise.hero.title": "Votre marque. Votre domaine. 10 000+ revendeurs & créateurs.",
    "enterprise.program.body":
      "Notre équipe configure votre compte, valide votre KYC en priorité et connecte votre catalogue avant l'ouverture du réseau revendeurs & créateurs.",
    "affiliate.referral.description":
      "Invitez des revendeurs & créateurs — 10% de leurs gains nets à chaque vente. Bonus bienvenue 5% pour vos filleuls (< 30j).",
    "sellPage.creator.title": "2. Partenaire revendeur / créateur",
    "sellPage.creator.body":
      "Sélectionnez des SKU fournisseur, fixez votre prix client et publiez sur votre vitrine — Affisell gère l'expérience d'achat de bout en bout.",
    "sellPage.ctaPartner": "Devenir partenaire revendeur / créateur",
    "companyPages.stats.stores": "Boutiques revendeurs & créateurs",
    "companyPages.about.metaTitle": "À propos d'Affisell — Marketplace revendeurs & créateurs",
    "companyPages.about.title": "L'infrastructure commerce des revendeurs & créateurs",
    "companyPages.about.description":
      "Affisell est une marketplace pensée pour les revendeurs et créateurs : les fournisseurs exposent leur catalogue, les partenaires lancent une vitrine en minutes, les acheteurs achètent en confiance.",
    "companyPages.about.mission.body":
      "Les revendeurs et créateurs doivent pouvoir monétiser leur audience sans stock ni logistique. Affisell orchestre la boucle complète — catalogue, paiement sécurisé, expédition fournisseur et signaux de confiance conformes RGPD.",
    "companyPages.about.values.0.title": "Vitrines revendeurs & créateurs",
    "companyPages.about.timeline.items.2024.body":
      "Lancement de la marketplace : catalogue fournisseur et vitrines partenaires revendeurs & créateurs.",
    "companyPages.about.timeline.items.2025a.body":
      "Outils de découverte produit et d'aide au choix pour les partenaires revendeurs & créateurs.",
    "companyPages.about.cta.creators": "Devenir revendeur / créateur",
    "companyPages.blog.metaTitle": "Blog Affisell — Produit & économie revendeurs",
    "companyPages.blog.metaDescription":
      "Actualités marketplace, transparence commissions et outils revendeurs & créateurs par l'équipe Affisell.",
    "companyPages.blog.description":
      "Lancements produit, économie marketplace et playbooks revendeurs & créateurs — rédigés par l'équipe qui construit Affisell.",
    "companyPages.blog.posts.swipe-feed-affiliate-hub.excerpt":
      "Les partenaires revendeurs & créateurs parcourent le catalogue en flux mobile et publissent leurs sélections en quelques gestes.",
    "companyPages.blog.posts.gdpr-marketplace-trust.sections.s3.body":
      "Les revendeurs et créateurs opèrent dans toute l'UE. Une conformité intégrée rassure les marques partenaires et les acheteurs.",
    "companyPages.blog.posts.creator-storefront-60s.title": "Lancer une vitrine revendeur en quelques minutes",
    "companyPages.blog.posts.creator-storefront-60s.category": "Revendeurs / Créateurs",
    "companyPages.blog.posts.creator-storefront-60s.sections.intro":
      "Affisell retire la charge ops du commerce revendeur & créateur : pas d'entrepôt, pas de configuration paiement from scratch.",
    "companyPages.blog.posts.creator-storefront-60s.sections.s3.body":
      "Créez un compte partenaire gratuit et publiez votre première fiche. La plupart des revendeurs & créateurs voient leur première vente rapidement.",
    "companyPages.careers.metaDescription":
      "Rejoignez l'équipe qui construit la marketplace revendeurs & créateurs — remote-friendly, Marseille.",
    "companyPages.careers.title": "Construisez l'économie revendeurs & créateurs avec nous",
    "companyPages.careers.culture.body":
      "Affisell est early-stage avec du trafic prod : vous shippez chaque semaine pour de vrais marchands, avec ownership bout-en-bout et contact direct revendeurs, créateurs et fournisseurs.",
    "companyPages.careers.roles.creator-success.title": "Partner Success Manager",
    "companyPages.careers.roles.creator-success.summary":
      "Onboarder les partenaires revendeurs & créateurs, améliorer la qualité des vitrines, remonter les insights produit.",
    "companyPages.careers.roles.creator-success.applySubject": "Candidature — Partner Success",
    "companyPages.careers.roles.creator-success.requirements.r1":
      "FR/EN courant ; expérience communautés revendeurs, créateurs ou e-commerce",
    "companyPages.careers.roles.creator-success.requirements.r3":
      "Empathie pour les revendeurs & créateurs entre audience et croissance",
    "companyPages.press.metaDescription":
      "Ressources médias, faits société et contact presse Affisell — marketplace revendeurs & créateurs.",
    "companyPages.press.description":
      "Faits, boilerplate et assets pour journalistes couvrant le commerce revendeurs & créateurs et la retail tech UE.",
    "companyPages.press.boilerplate.short":
      "Affisell est une marketplace revendeurs & créateurs reliant fournisseurs vérifiés, vitrines partenaires et acheteurs — avec conformité UE intégrée.",
    "companyPages.press.boilerplate.long":
      "Fondée à Marseille, Affisell permet aux revendeurs et créateurs de lancer une boutique brandée en minutes sans stock. Les fournisseurs distribuent via un réseau de partenaires avec fulfillment automatisé. La plateforme inclut outils de découverte, self-service RGPD et suivi commande transparent.",
    "luxe.subtitle": "Pièces curatoriales · revendeurs & créateurs authentifiés · visibilité limitée",
    "demoLab.personas.buyer.cardBody": "Expérience d'achat sur les boutiques revendeurs & créateurs.",
    "demoLab.steps.affiliate.discover.body": "Flux live shopping et vitrines revendeurs & créateurs.",
    "demoLab.steps.buyer.shop.body": "Parcours shop revendeur & fiche produit.",
    "demoLab.storefrontFormats.architectureDiagram":
      "Marchand affilié\n├── /shops/[slug]     → Brand Studio (chrome acheteur, sections modulaires)\n├── /boutique/[slug]  → Boutique procédurale (1024 skins, studio design)\n├── /embed/shops/[slug] → Widget embarqué (toggle Brand Studio)\n└── domaine custom CNAME → rewrite vers /shops/[slug]\n\nMarchand fournisseur\n└── /store/supplier/[slug] → Vitrine catalogue supplier\n\nRevendeur / Créateur (Légion)\n└── /u/[username] → Vitrine @handle (parallèle au slug Store)",
    "demoLab.storefrontFormats.audiences.creator": "Revendeur / Créateur",
    "demoLab.storefrontFormats.formats.legion-profile.role":
      "Vitrine handle revendeur / créateur (@username). Identité parallèle au slug Store — optimisée trafic social et parrainage Légion.",
    "demoLab.storefrontFormats.links.shopsBrowse": "Parcourir les boutiques revendeurs & créateurs",
    "emails.passwordReset.portalAffiliate": "Espace revendeur",
  },
  de: {
    "creators.meta.title": "Auf Affisell verkaufen — Reseller- & Creator-Storefront",
    "creators.hero.badgeCreators": "500+ Reseller & Creator",
    "creators.social.title": "Reseller & Creator wachsen mit Affisell",
    "creators.preview.title": "Ihr Reseller-Dashboard",
    "partners.hero.title": "Vertrieb über 10.000+ Reseller & Creator",
    "partners.backCreators": "← Reseller / Creator",
    "companyPages.stats.stores": "Reseller- & Creator-Shops",
    "companyPages.about.metaTitle": "Über Affisell — Reseller- & Creator-Marketplace",
    "companyPages.about.title": "Commerce-Infrastruktur für Reseller & Creator",
    "companyPages.about.description":
      "Affisell ist eine Marketplace für Reseller und Creator: Lieferanten listen ihren Katalog, Partner starten in Minuten eine Storefront.",
    "companyPages.about.cta.creators": "Reseller / Creator werden",
    "emails.passwordReset.portalAffiliate": "Reseller-Bereich",
  },
  es: {
    "creators.meta.title": "Vender en Affisell — Tienda revendedor / creador",
    "creators.hero.badgeCreators": "500+ revendedores y creadores",
    "creators.social.title": "Revendedores y creadores que crecen con Affisell",
    "companyPages.about.title": "Infraestructura comercial para revendedores y creadores",
    "companyPages.about.description":
      "Affisell es una marketplace para revendedores y creadores: proveedores, vitrinas y compradores con confianza.",
    "companyPages.about.cta.creators": "Ser revendedor / creador",
    "companyPages.stats.stores": "Tiendas revendedores y creadores",
  },
  it: {
    "creators.meta.title": "Vendi su Affisell — Vetrina rivenditore / creator",
    "creators.hero.badgeCreators": "500+ rivenditori e creator",
    "companyPages.about.title": "Infrastruttura commerce per rivenditori e creator",
    "companyPages.about.description":
      "Affisell è una marketplace per rivenditori e creator: catalogo fornitori, vetrine partner e acquisto sicuro.",
    "companyPages.about.cta.creators": "Diventa rivenditore / creator",
    "companyPages.stats.stores": "Negozi rivenditori e creator",
  },
  nl: {
    "creators.meta.title": "Verkopen op Affisell — Reseller- & creator-storefront",
    "creators.hero.badgeCreators": "500+ resellers & creators",
    "companyPages.about.title": "Commerce-infrastructuur voor resellers & creators",
    "companyPages.about.description":
      "Affisell is een marketplace voor resellers en creators: leveranciers, partner-storefronts en vertrouwd shoppen.",
    "companyPages.about.cta.creators": "Word reseller / creator",
    "companyPages.stats.stores": "Reseller- & creator-winkels",
  },
  pl: {
    "creators.meta.title": "Sprzedawaj na Affisell — Sklep resellera / creatora",
    "creators.hero.badgeCreators": "500+ resellerów i creatorów",
    "companyPages.about.title": "Infrastruktura commerce dla resellerów i creatorów",
    "companyPages.about.description":
      "Affisell to marketplace dla resellerów i creatorów: katalog dostawców, witryny partnerów i pewne zakupy.",
    "companyPages.about.cta.creators": "Zostań resellerem / creatorem",
    "companyPages.stats.stores": "Sklepy resellerów i creatorów",
  },
  zh: {
    "creators.meta.title": "在 Affisell 销售 — 经销商/创作者店铺",
    "creators.hero.badgeCreators": "500+ 经销商与创作者",
    "companyPages.about.title": "面向经销商与创作者的商业基础设施",
    "companyPages.about.description":
      "Affisell 是为经销商与创作者打造的 marketplace：供应商目录、伙伴店铺与可信购物。",
    "companyPages.about.cta.creators": "成为经销商/创作者",
    "companyPages.stats.stores": "经销商与创作者店铺",
  },
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".")
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {}
    cur = cur[key]
  }
  cur[parts[parts.length - 1]] = value
}

for (const [locale, strings] of Object.entries(LOCALE_STRINGS)) {
  const filePath = path.join(root, "messages", `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
  let count = 0
  for (const [key, value] of Object.entries(strings)) {
    setPath(data, key, value)
    count++
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`[brand-terminology] ${locale}.json — ${count} strings updated`)
}

console.log("[brand-terminology] done — run npm run i18n:parity")
