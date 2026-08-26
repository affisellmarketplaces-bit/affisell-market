import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { AFFISELL_LEGAL_SYSTEM_PROMPT, LEGAL_AI_MODEL } from "@/lib/legal/brain"
import { readCompanyLegal } from "@/lib/legal/company-env"
import type {
  CgvInput,
  ContratFournisseurInput,
  GeneratedLegalDocument,
  LegalDocumentType,
  MentionsInput,
} from "@/lib/legal/document-types"
import { legalMarkdownToHtml } from "@/lib/legal/markdown-html"

const RETRACTATION_PATH = "/legal/retractation"

export type GenerateDocumentInput =
  | { type: "cgv"; data: CgvInput }
  | { type: "cgu"; data: Record<string, never> }
  | { type: "mentions"; data: MentionsInput }
  | { type: "contrat_fournisseur"; data: ContratFournisseurInput }

export function defaultDocumentData() {
  const company = readCompanyLegal()
  const legalName = process.env.LEGAL_COMPANY_NAME?.trim() || company.name
  const siret = process.env.LEGAL_SIRET?.trim() || company.siret
  const adresse = process.env.LEGAL_COMPANY_ADDRESS?.trim() || company.address

  return {
    cgv: {
      companyName: legalName,
      marketplaceName: `${legalName} Market`,
    },
    mentions: {
      companyName: legalName,
      siret,
      adresse,
    },
    contrat: {
      supplierName: "Fournisseur Professionnel",
      commission: 10,
      companyName: legalName,
    },
  }
}

function documentTitle(type: LegalDocumentType, input?: GenerateDocumentInput): string {
  switch (type) {
    case "cgv":
      return `CGV Marketplace`
    case "cgu":
      return `CGU Utilisateurs`
    case "mentions":
      return `Mentions légales`
    case "contrat_fournisseur":
      return input && input.type === "contrat_fournisseur"
        ? `Contrat cadre — ${input.data.supplierName}`
        : `Contrat cadre fournisseur`
    default:
      return "Document juridique"
  }
}

function buildStaticCgv(input: CgvInput): string {
  const id = AFFISELL_LEGAL_IDENTITY
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return `# Conditions Générales de Vente — ${input.marketplaceName}

**Version :** ${today}  
**Opérateur :** ${input.companyName} — ${id.legalForm}  
**SIRET :** ${id.siret} · **RCS :** ${id.rcs}

---

## 1. Définitions

- **Plateforme** : le site et les services ${input.marketplaceName} exploités par ${input.companyName}.
- **Acheteur** : toute personne physique ou morale passant commande via la Plateforme.
- **Vendeur professionnel** : tout fournisseur tiers proposant des Produits via la Plateforme.
- **Produit** : bien ou service proposé à la vente par un Vendeur professionnel.
- **Commande** : acte d'achat portant sur un Produit unique (1 commande = 1 produit).

## 2. Rôle d'intermédiaire — statut de plateforme en ligne

${input.companyName} agit en qualité d'**intermédiaire technique** au sens du Règlement (UE) 2022/2065 (Digital Services Act — DSA), articles 3 à 5, et de la jurisprudence **Cass. com., 2023** (distinction intermédiaire / vendeur apparent).

${input.companyName} **n'est pas le vendeur** des Produits : le contrat de vente est conclu directement entre l'Acheteur et le Vendeur professionnel identifié avant validation de la Commande.

La Plateforme met à disposition : hébergement des fiches produits, tunnel de commande, encaissement via prestataire de paiement agréé (Stripe), et outils de suivi.

## 3. Information précontractuelle

Conformément aux articles **L111-1 et suivants** du Code de la consommation, l'Acheteur reçoit avant paiement : identité du Vendeur, caractéristiques essentielles du Produit, prix TTC, frais de livraison, délais, et modalités de rétractation le cas échéant.

## 4. Paiement

Le paiement est sécurisé via **Stripe** (DSP2, authentification forte lorsque requise). ${input.companyName} peut percevoir les fonds au nom et pour compte du Vendeur (Stripe Connect).

En cas de litige bancaire (chargeback), la Plateforme coopère avec le Vendeur et l'Acheteur dans la limite de ses obligations légales.

## 5. Livraison

Les délais et modalités de livraison sont indiqués sur la fiche Produit et confirmés par email. Le transfert des risques s'opère selon les conditions du Vendeur, sous réserve des dispositions impératives du Code de la consommation (art. **L216-1 et s.**).

## 6. Droit de rétractation — art. L221-18 et s.

L'Acheteur consommateur dispose d'un délai de **14 jours** à compter de la réception du Produit pour exercer son droit de rétractation, sauf exceptions légales (art. L221-28).

Formulaire et instructions : page ${RETRACTATION_PATH} sur la Plateforme.

Remboursement sous 14 jours à compter de la notification de rétractation, via le même moyen de paiement sauf accord contraire.

## 7. Garanties légales

Art. **L217-4 et s.** (garantie légale de conformité) et art. **1641 et s.** du Code civil (vices cachés) — responsabilité du Vendeur professionnel.

## 8. Retours et remboursements

Les demandes de retour s'effectuent via l'espace commande ou le support ${readCompanyLegal().supportEmail}. En cas de rupture de stock ou d'annulation, remboursement intégral sans frais.

## 9. Lutte contre la contrefaçon

Conformément aux articles **L335-3 et s.** du Code de la propriété intellectuelle, tout signalement de contrefaçon peut être adressé à la Plateforme (notice & takedown — LCEN art. 6-I-7). ${input.companyName} peut suspendre un Vendeur en cas de réitération.

## 10. Médiation et litiges

Art. **L612-1 et s.** : en cas de litige non résolu, l'Acheteur consommateur peut recourir gratuitement au médiateur de la consommation (**CM2C** — https://www.cm2c.net) ou à la plateforme européenne ODR (https://ec.europa.eu/consumers/odr).

Compétence : tribunaux français, sous réserve des règles impératives de protection du consommateur.

## 11. Données personnelles (RGPD)

Traitement des données conformément au Règlement (UE) 2016/679 — bases légales art. **6** (exécution du contrat, intérêt légitime, consentement cookies). Politique de confidentialité accessible sur la Plateforme. DPO : dpo@affisell.com.

## 12. DSA — transparence et signalement

Point de contact DSA : legal@affisell.com. Mécanisme de signalement de contenus illicites disponible sur la Plateforme. ${input.companyName} publie, le cas échéant, les rapports de transparence requis par le DSA.

---

*Document généré par l'Avocat Numérique Affisell — analyse d'aide à la décision. Validation par avocat inscrit au barreau recommandée avant publication définitive.*`
}

function buildStaticCgu(): string {
  const id = AFFISELL_LEGAL_IDENTITY
  const company = readCompanyLegal()

  return `# Conditions Générales d'Utilisation — ${company.name}

**Opérateur :** ${company.legalName} — ${id.legalForm}  
**SIRET :** ${company.siret}

---

## 1. Objet

Les présentes CGU régissent l'accès et l'utilisation de la marketplace Affisell par les **Acheteurs**, **Affiliés/revendeurs** et **Fournisseurs professionnels**.

## 2. Comptes utilisateurs

Chaque Utilisateur fournit des informations exactes. Les Fournisseurs et Affiliés professionnels acceptent les obligations DSA (KYC, information légale, conformité catalogue).

## 3. Statut des parties

- **Affisell** : intermédiaire technique (DSA art. 3-5), non vendeur des Produits tiers.
- **Fournisseur** : vendeur professionnel responsable des Produits, prix affichés (L442-1), conformité CE, livraison.
- **Affilié** : revendeur mandataire ou partenaire commercial selon contrat d'affiliation.
- **Acheteur** : consommateur ou professionnel selon qualification.

## 4. Contenus et UGC

Avis, photos et contenus générés par les utilisateurs restent sous leur responsabilité. Affisell modère selon le DSA et peut retirer tout contenu manifestement illicite.

## 5. Propriété intellectuelle

Les marques, logiciels et design Affisell sont protégés. Toute reproduction non autorisée est interdite.

## 6. Paiements et commissions

Flux Stripe Connect. Commissions d'affiliation et retenues plateforme selon grilles contractuelles acceptées à l'inscription.

## 7. Suspension et résiliation

Affisell peut suspendre un compte en cas de violation des CGU, fraude, contrefaçon, ou pratiques commerciales trompeuses (L121-1).

## 8. Données personnelles

Voir Politique de confidentialité. Droits RGPD : accès, rectification, effacement, opposition — ${company.dpoEmail}.

## 9. Loi applicable

Droit français. Médiation consommation : ${company.mediatorName} — ${company.mediatorUrl}.

---

*Analyse d'aide à la décision — validation avocat recommandée.*`
}

function buildStaticMentions(input: MentionsInput): string {
  const company = readCompanyLegal()

  return `# Mentions légales

**Éditeur du site :** ${input.companyName}  
**Forme juridique :** ${company.legalForm}  
**Siège social :** ${input.adresse}  
**SIRET :** ${input.siret} · **SIREN :** ${company.siren}  
**RCS :** ${company.rcs}  
**Capital :** ${company.capital}  
**N° TVA :** ${company.tva || company.vatRegime}  
**Code NAF :** ${company.naf}

**Directeur de la publication :** ${company.publisher}  
**Contact :** ${company.contactEmail}  
**Support :** ${company.supportEmail}  
**DPO :** ${company.dpoEmail}

**Hébergeur :** ${company.host}

**Médiateur de la consommation (L612-1) :** ${company.mediatorName} — ${company.mediatorUrl}  
**Plateforme ODR UE :** ${company.odrUrl}

---

Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).`
}

function buildStaticContratFournisseur(input: ContratFournisseurInput): string {
  const id = AFFISELL_LEGAL_IDENTITY
  const platform = input.companyName ?? readCompanyLegal().name
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return `# Contrat cadre de fourniture — Marketplace ${platform}

**Entre :**  
${platform} — ${id.legalName}, SIRET ${id.siret} (« **la Plateforme** »)

**Et :**  
${input.supplierName} (« **le Fournisseur** »)

**Date :** ${today}

---

## 1. Objet

Le Fournisseur référence et vend des Produits via la marketplace ${platform}, sous le statut d'**intermédiaire** de la Plateforme (DSA, Cass. com. 2023).

## 2. Statut — non vendeur de la Plateforme

La Plateforme n'est pas partie au contrat de vente avec l'Acheteur final. Le Fournisseur est seul vendeur professionnel.

## 3. Commission

Commission plateforme : **${input.commission} %** TTC du montant des ventes nettes, prélevée via Stripe Connect, sauf accord écrit contraire.

## 4. Prix et pratiques commerciales — L442-1

Le Fournisseur garantit l'exactitude des prix, l'absence de pratiques trompeuses (L121-1) et le respect des délais de livraison annoncés.

## 5. Qualité, conformité CE et sécurité

Le Fournisseur garantit la conformité des Produits (marquage CE le cas échéant), la sécurité, et la licéité de leur commercialisation.

## 6. Contrefaçon et PI

Le Fournisseur indemnise la Plateforme en cas de réclamation pour contrefaçon (L335-3). Suspension immédiate possible en cas de signalement fondé.

## 7. Données et RGPD

Le Fournisseur agit en responsable de traitement pour les données Acheteurs liées à ses commandes ; art. 28 RGPD pour les sous-traitants communs.

## 8. Durée et résiliation

Contrat à durée indéterminée. Résiliation avec préavis de 30 jours. Résiliation immédiate en cas de manquement grave (fraude, contrefaçon, L121-1).

## 9. Signature

Fait en deux exemplaires électroniques. Loi n°2000-230 relative à la signature électronique.

**Pour la Plateforme** — ${platform}  
**Pour le Fournisseur** — ${input.supplierName}

---

*Contrat type généré par Affisell Avocat Numérique — validation avocat recommandée.*`
}

function buildStaticDocument(input: GenerateDocumentInput): GeneratedLegalDocument {
  let markdown: string
  let title: string

  switch (input.type) {
    case "cgv":
      markdown = buildStaticCgv(input.data)
      title = `CGV ${input.data.marketplaceName}`
      break
    case "cgu":
      markdown = buildStaticCgu()
      title = "CGU Utilisateurs"
      break
    case "mentions":
      markdown = buildStaticMentions(input.data)
      title = `Mentions légales — ${input.data.companyName}`
      break
    case "contrat_fournisseur":
      markdown = buildStaticContratFournisseur(input.data)
      title = `Contrat cadre — ${input.data.supplierName}`
      break
  }

  return {
    markdown,
    html: legalMarkdownToHtml(markdown, title),
    title,
  }
}

async function enhanceWithAi(
  input: GenerateDocumentInput,
  fallback: GeneratedLegalDocument
): Promise<GeneratedLegalDocument> {
  if (!hasOpenAiFallback()) return fallback

  const payload =
    input.type === "cgu"
      ? { type: input.type }
      : { type: input.type, data: input.data }

  try {
    const raw = await openaiChatText({
      model: LEGAL_AI_MODEL,
      temperature: 0.15,
      max_tokens: 6_000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AFFISELL_LEGAL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Rédige un document juridique complet en français (niveau Bredin Prat) pour Affisell marketplace.

Type : ${input.type}
Données : ${JSON.stringify(payload)}

Exigences selon le type :
- cgv : DSA art 3-5, RGPD, rétractation L221-18, médiation L612-1, anti-contrefaçon L335-3, sections Définitions / Intermédiaire / Paiement / Livraison / Retours / Litiges / Données
- cgu : acheteurs, affiliés, fournisseurs, UGC, DSA
- mentions : LCEN complètes (éditeur, hébergeur, médiateur, DPO)
- contrat_fournisseur : statut intermédiaire, commission, L442-1, CE, contrefaçon, résiliation

Réponds en JSON strict : { "markdown": "...", "title": "..." }
markdown = document complet avec titres ## et numérotation. Pas de html dans markdown.`,
        },
      ],
    })

    if (!raw) return fallback

    const parsed = JSON.parse(raw) as { markdown?: string; title?: string }
    const markdown = parsed.markdown?.trim()
    if (!markdown || markdown.length < 500) return fallback

    const title = parsed.title?.trim() || fallback.title
    return {
      markdown,
      html: legalMarkdownToHtml(markdown, title),
      title,
    }
  } catch (error) {
    console.error("[legal:avocat-documents]", {
      result: "ai_failed",
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return fallback
  }
}

export async function generateCGV(input: CgvInput): Promise<GeneratedLegalDocument> {
  return generateLegalDocument({ type: "cgv", data: input })
}

export async function generateCGU(): Promise<GeneratedLegalDocument> {
  return generateLegalDocument({ type: "cgu", data: {} })
}

export async function generateMentionsLegales(input: MentionsInput): Promise<GeneratedLegalDocument> {
  return generateLegalDocument({ type: "mentions", data: input })
}

export async function generateContratFournisseur(
  input: ContratFournisseurInput
): Promise<GeneratedLegalDocument> {
  return generateLegalDocument({ type: "contrat_fournisseur", data: input })
}

export async function generateLegalDocument(input: GenerateDocumentInput): Promise<GeneratedLegalDocument> {
  const fallback = buildStaticDocument(input)
  const enhanced = await enhanceWithAi(input, fallback)

  console.log("[legal:avocat-documents]", {
    result: "generated",
    type: input.type,
    title: enhanced.title,
    aiUsed: enhanced.markdown !== fallback.markdown,
  })

  return enhanced
}

export { documentTitle }
