import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Affisell",
  description: "CGU Affisell — rôles marketplace, compte, contenus interdits, résiliation.",
}

const LAST_UPDATED = "2026-06-01"

export default function CguPage() {
  const c = readCompanyLegal()

  return (
    <LegalPageShell
      title="Conditions générales d'utilisation (CGU)"
      description="Règles d'accès et d'utilisation de la plateforme Affisell."
      lastUpdated={LAST_UPDATED}
    >
      <h2>1. Objet</h2>
      <p>
        Les présentes CGU régissent l&apos;accès et l&apos;utilisation du site et des services {c.name} (« Affisell »),
        marketplace de mise en relation entre clients, fournisseurs (Suppliers), affiliés (Affiliates / créateurs) et
        la plateforme.
      </p>

      <h2>2. Rôles sur la plateforme</h2>
      <ul>
        <li>
          <strong>Affisell</strong> : éditeur de la plateforme, hébergement, paiement, conformité, médiation commerciale.
        </li>
        <li>
          <strong>Supplier (fournisseur)</strong> : vendeur des produits, responsable du stock, de l&apos;expédition et
          du SAV produit, sous sa marque ou celle du fabricant.
        </li>
        <li>
          <strong>Affiliate (affilié / créateur)</strong> : partenaire qui référence des produits et peut percevoir une
          commission sur les ventes générées via son lien ou sa boutique.
        </li>
        <li>
          <strong>Client</strong> : acheteur consommateur ou professionnel selon le contexte de la commande.
        </li>
      </ul>

      <h2>3. Compte utilisateur</h2>
      <p>
        La création d&apos;un compte requiert des informations exactes. Vous êtes responsable de la confidentialité de
        vos identifiants. Affisell peut suspendre ou supprimer un compte en cas de fraude, non-respect des CGU/CGV ou
        injonction légale.
      </p>

      <h2>4. Contenus interdits</h2>
      <p>Il est interdit de publier ou vendre via Affisell :</p>
      <ul>
        <li>produits illégaux, contrefaisons, armes, substances prohibées ;</li>
        <li>contenus haineux, diffamatoires, pornographiques impliquant des mineurs ;</li>
        <li>données personnelles de tiers sans base légale ;</li>
        <li>schémas pyramidaux ou publicités trompeuses.</li>
      </ul>
      <p>
        Affisell se réserve le droit de retirer tout contenu et de résilier les comptes concernés sans préavis en cas
        de violation grave.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <p>
        La marque Affisell, l&apos;interface et les logiciels associés restent la propriété de {c.name}. Les contenus
        fournis par les Suppliers et Affiliates leur appartiennent ou à leurs concédants ; une licence limitée est
        accordée à Affisell pour l&apos;exploitation de la marketplace.
      </p>

      <h2>6. Responsabilité</h2>
      <p>
        Affisell met en œuvre des moyens raisonnables pour assurer la disponibilité du service. Elle n&apos;est pas
        responsable des interruptions indépendantes de sa volonté (réseau, hébergeur, force majeure). La responsabilité
        liée aux produits incombe au Supplier, sous réserve des obligations légales d&apos;Affisell en tant
        qu&apos;intermédiaire.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        Vous pouvez fermer votre compte à tout moment via les paramètres ou en contactant{" "}
        <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>. Affisell peut résilier l&apos;accès en cas de
        manquement, avec conservation des données nécessaires aux obligations légales et comptables.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Les CGU sont régies par le droit français. Les consommateurs de l&apos;UE conservent les droits impératifs de
        leur pays de résidence. Voir aussi les <a href="/cgv">CGV</a> et la{" "}
        <a href="/privacy">politique de confidentialité</a>.
      </p>
    </LegalPageShell>
  )
}
