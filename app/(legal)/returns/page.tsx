import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Retours et remboursements | Affisell",
  description: "Politique de retour Affisell — 14 jours, frais, remboursement, produits défectueux.",
}

const LAST_UPDATED = "2026-06-01"

export default function ReturnsPage() {
  const c = readCompanyLegal()

  return (
    <LegalPageShell
      title="Politique de retours et remboursements"
      description="Procédure claire pour retourner un produit ou obtenir un remboursement sur Affisell."
      lastUpdated={LAST_UPDATED}
    >
      <h2>Délai de rétractation</h2>
      <p>
        Vous disposez de <strong>14 jours calendaires</strong> à compter de la <strong>réception</strong> du colis pour
        changer d&apos;avis (Union européenne), sauf exceptions légales (produits personnalisés, scellés hygiène
        descellés, etc.).
      </p>

      <h2>Conditions du retour</h2>
      <ul>
        <li>Produit <strong>non utilisé</strong>, en parfait état ;</li>
        <li>Emballage d&apos;origine intact dans la mesure du possible ;</li>
        <li>Tous accessoires et notices inclus.</li>
      </ul>

      <h2>Comment procéder ?</h2>
      <ol>
        <li>
          Ouvrez une demande depuis{" "}
          <a href="/marketplace/account/orders">Mes commandes</a> ou écrivez à{" "}
          <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> avec votre numéro de commande.
        </li>
        <li>
          Nous vous envoyons par email l&apos;<strong>adresse de retour</strong> (souvent en Chine ou en Europe selon le
          fournisseur).
        </li>
        <li>Expédiez le colis avec un suivi ; conservez la preuve d&apos;envoi.</li>
      </ol>

      <h2>Frais de retour</h2>
      <p>
        Sauf produit <strong>défectueux ou non conforme</strong>, les <strong>frais de retour sont à votre charge</strong>.
        Nous vous conseillons un transporteur avec suivi. Affisell n&apos;est pas responsable des colis perdus sans
        preuve d&apos;expédition.
      </p>

      <h2>Remboursement</h2>
      <p>
        Après réception et vérification du retour par le fournisseur, le remboursement est effectué sur votre moyen de
        paiement initial, <strong>sous 14 jours</strong> (délai légal maximum, souvent plus rapide).
      </p>

      <h2>Produit défectueux</h2>
      <p>
        En cas de défaut : envoyez des <strong>photos claires</strong> (produit, emballage, étiquette) à{" "}
        {c.supportEmail}. Si le montant est inférieur à <strong>20 €</strong> et que le défaut est manifeste, nous
        pouvons proposer un <strong>remboursement sans retour</strong> pour éviter des frais de logistique
        disproportionnés. Au-delà, un retour ou un remplacement pourra être exigé.
      </p>

      <h2>Échanges</h2>
      <p>
        Les échanges (autre taille/couleur) sont traités comme un retour suivi d&apos;une nouvelle commande, sauf accord
        contraire du fournisseur.
      </p>

      <p className="text-zinc-500">
        Cette politique complète les <a href="/cgv">CGV</a>. En cas de conflit, les dispositions légales impératives du
        consommateur prévalent.
      </p>
    </LegalPageShell>
  )
}
