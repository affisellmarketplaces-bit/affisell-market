import type { SignalPriority, StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — from alerts to decisions (pure).
 *
 * Detectors look at ONE thing each (delay, price, quality, Safety Gate, a cheaper source…). What the founder decides on
 * is an ENTITY: a supplier, a product. When several independent detectors point at the same entity, the problem is
 * stronger than any single alert and the right action is often different (a slow supplier whose products are ALSO
 * cheaper elsewhere = move the volume; a product flagged by Safety Gate AND by buyer returns = treat first).
 *
 * Rules:
 *  - an entity is synthesised only when signals of at least TWO DIFFERENT families (`<prefix>:<kind>`) name it as a
 *    subject — the same detector firing twice is not corroboration;
 *  - the synthesis is a `recommendation`; it carries no number of its own, only the member signals' titles, and its
 *    priority is the highest of its members (it never raises a member's priority);
 *  - the action is chosen by named combination rules below, otherwise a generic "treat together";
 *  - nothing is applied: no price, listing, supplier or payout is changed.
 */
export type SignalSubject = NonNullable<StrategicSignal["subjects"]>[number]

export function signalFamilyOf(id: string): string {
  return id.split(":").slice(0, 2).join(":")
}

const FAMILY_FR: Record<string, string> = {
  "supplier:slow": "délais",
  "supplier:price-increase": "hausse de prix",
  "logistics:sla-risk": "commandes bientôt annulées (délai d'expédition)",
  "risk:quality": "problèmes de qualité",
  "risk:safety-gate": "alerte Safety Gate",
  "supplier:cheaper-same-gtin": "même produit moins cher ailleurs",
  "supplier:faster-same-gtin": "même produit livré plus vite ailleurs",
  "discovery:under-distributed": "demande prouvée, peu distribué",
}

const RANK: Record<SignalPriority, number> = { critical: 0, important: 1, study: 2 }

/** Decision rule for a set of families, most specific first. */
function actionFor(type: SignalSubject["type"], families: Set<string>): string {
  const has = (f: string) => families.has(f)
  const alternative = has("supplier:cheaper-same-gtin") || has("supplier:faster-same-gtin")
  if (type === "product") {
    if (has("risk:safety-gate") && has("risk:quality"))
      return "Traiter en premier : alerte de sécurité ET retours d'acheteurs. Vérifier le lot livré ; si le risque est confirmé, suivre la procédure de rappel."
    if (has("risk:safety-gate") && alternative)
      return "Vérifier l'alerte de sécurité ; si elle concerne ce produit, orienter les revendeurs vers la même référence chez l'autre fournisseur, après vérification de son lot."
    if (has("risk:quality") && alternative)
      return "Le même produit existe chez un autre fournisseur : comparer ses retours et ses délais, puis proposer l'alternative aux revendeurs (rien n'est changé automatiquement)."
    if (has("discovery:under-distributed") && has("risk:quality"))
      return "Ne pas pousser sa distribution tant que la cause des retours n'est pas comprise."
    if (has("discovery:under-distributed") && alternative)
      return "Demande prouvée et meilleure source disponible : la mettre en avant chez les revendeurs avec la source alternative."
  } else {
    if ((has("supplier:slow") || has("logistics:sla-risk")) && has("risk:quality"))
      return "Lent ET à problèmes de qualité : réévaluer la relation, chercher des sources alternatives pour ses produits les plus vendus avant d'y orienter de nouveaux revendeurs."
    if (has("supplier:price-increase") && (has("supplier:slow") || has("logistics:sla-risk")))
      return "Plus cher et plus lent : préparer des alternatives pour ses produits phares et en parler au fournisseur avec ces chiffres."
    if (has("logistics:sla-risk") && has("supplier:slow"))
      return "Retards structurels : des commandes seront remboursées automatiquement ; contacter le fournisseur aujourd'hui."
  }
  return "Plusieurs signaux indépendants visent la même entité : les traiter ensemble plutôt qu'un par un."
}

export function entitySynthesisSignals(signals: StrategicSignal[], ctx: { observedAt: string }): StrategicSignal[] {
  const groups = new Map<string, { subject: SignalSubject; members: StrategicSignal[] }>()
  for (const s of signals) {
    if (s.id.startsWith("synthesis:")) continue
    for (const subj of s.subjects ?? []) {
      const key = `${subj.type}:${subj.id}`
      const g = groups.get(key) ?? { subject: subj, members: [] }
      if (!g.members.some((m) => m.id === s.id)) g.members.push(s)
      groups.set(key, g)
    }
  }
  const out: StrategicSignal[] = []
  for (const { subject, members } of groups.values()) {
    const families = new Set(members.map((m) => signalFamilyOf(m.id)))
    if (families.size < 2) continue
    const sorted = [...members].sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.id.localeCompare(b.id))
    const top = sorted[0]
    const famTxt = [...families].map((f) => FAMILY_FR[f] ?? f).join(" + ")
    out.push({
      id: `synthesis:${subject.type}:${subject.id}`,
      domain: subject.type === "supplier" ? "supplier" : top.domain,
      priority: top.priority,
      kind: "recommendation",
      title: `${subject.type === "supplier" ? "Fournisseur" : "Produit"} « ${subject.label} » : ${famTxt}`,
      evidence: sorted.map((m) => ({ label: FAMILY_FR[signalFamilyOf(m.id)] ?? signalFamilyOf(m.id), value: m.title })),
      source: { id: "affisell.cockpit", query: `Signaux de ${families.size} familles différentes visant la même entité (${sorted.map((m) => m.id).join(", ")})` },
      observedAt: ctx.observedAt,
      window: null,
      confidence: families.size >= 3 ? "high" : "medium",
      confidenceReason:
        "Convergence de détecteurs indépendants (sources ou mesures différentes) ; chaque signal garde sa propre preuve ci-dessous. Recommandation, rien n'est appliqué.",
      recommendedAction: actionFor(subject.type, families),
      link: top.link,
    })
  }
  return out.sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.evidence.length - a.evidence.length).slice(0, 15)
}
