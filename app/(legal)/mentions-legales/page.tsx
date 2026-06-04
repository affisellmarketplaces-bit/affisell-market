import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Mentions légales | Affisell",
  description: "Éditeur, hébergeur, directeur de publication et contact Affisell.",
}

const LAST_UPDATED = "2026-06-01"

export default function MentionsLegalesPage() {
  const c = readCompanyLegal()

  return (
    <LegalPageShell
      title="Mentions légales"
      description="Informations légales obligatoires concernant le site affisell.com."
      lastUpdated={LAST_UPDATED}
    >
      <h2>Éditeur du site</h2>
      <ul>
        <li>
          <strong>Raison sociale :</strong> {c.name}
        </li>
        <li>
          <strong>Capital social :</strong> {c.capital}
        </li>
        <li>
          <strong>SIRET :</strong> {c.siret}
        </li>
        <li>
          <strong>Siège social :</strong> {c.address}
        </li>
        <li>
          <strong>Email :</strong>{" "}
          <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>
        </li>
      </ul>

      <h2>Directeur de la publication</h2>
      <p>{c.publisher}</p>

      <h2>Contact</h2>
      <p>
        Support clients : <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>
        <br />
        Formulaire : <a href="/contact">/contact</a>
      </p>

      <h2>Médiation de la consommation</h2>
      <p>
        Conformément à l&apos;article L.612-1 du Code de la consommation, le consommateur peut recourir
        gratuitement au service de médiation CM2C.
      </p>
      <p>
        CM2C - 14 rue Saint-Jean, 75017 Paris
        <br />
        Site :{" "}
        <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer">
          https://www.cm2c.net
        </a>
        <br />
        Email : <a href="mailto:contact@cm2c.net">contact@cm2c.net</a>
        <br />
        Téléphone : 01 89 47 00 14
      </p>

      <h2>Hébergeur</h2>
      <p>
        <strong>Vercel Inc.</strong>
        <br />
        340 S Lemon Ave #4133
        <br />
        Walnut, CA 91789, États-Unis
        <br />
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
          vercel.com
        </a>
      </p>

      <h2>Délégué à la protection des données (DPO)</h2>
      <p>
        <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>
        <br />
        Voir la <a href="/privacy">politique de confidentialité</a> pour l&apos;exercice de vos droits RGPD.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du site (textes, graphismes, logo, structure) est protégé. Toute reproduction non autorisée est
        interdite.
      </p>

      <h2>Crédits</h2>
      <p>
        Paiements : Stripe, Inc. — Conformité TVA et facturation selon les CGV.
      </p>
    </LegalPageShell>
  )
}
