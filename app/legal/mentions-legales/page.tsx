import type { Metadata } from "next"

import { LegalLaunchShell, LegalSection } from "@/components/legal/legal-launch-shell"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { VERCEL_HOST_LEGAL } from "@/lib/legal/mentions-constants"

export const metadata: Metadata = {
  title: "Mentions légales | Affisell",
  description:
    "Mentions légales Affisell — entreprise individuelle HOUAGA Nelson Wolfgang, SIRET 99119663500015, NAF 4791B.",
  robots: { index: true, follow: true },
}

export default function MentionsLegalesPage() {
  const c = readCompanyLegal()
  const host = VERCEL_HOST_LEGAL
  const secondary = AFFISELL_LEGAL_IDENTITY.hostSecondary

  return (
    <LegalLaunchShell
      title="Mentions légales"
      description="Informations obligatoires relatives à l’éditeur du site Affisell (LCEN) et à l’hébergement."
    >
      <LegalSection id="editeur" title="Éditeur du site">
        <p>
          Le site <strong className="text-zinc-900 dark:text-white">Affisell</strong> est édité par{" "}
          <strong className="text-zinc-900 dark:text-white">
            l’entreprise individuelle {c.legalName}
          </strong>
          , exploitant sous le nom commercial Affisell.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>SIRET : {c.siret}</li>
          <li>SIREN : {c.siren}</li>
          <li>Code NAF : {c.naf}</li>
          <li>Forme : {c.legalForm}</li>
          <li>Activité depuis le {AFFISELL_LEGAL_IDENTITY.activitySince}</li>
          <li>Adresse de domiciliation : {c.domiciliationAddress}</li>
          <li>
            Contact :{" "}
            <a className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" href={`mailto:${c.contactEmail}`}>
              {c.contactEmail}
            </a>
          </li>
          <li>{c.vatRegime || AFFISELL_LEGAL_IDENTITY.vatRegimeFr}</li>
        </ul>
      </LegalSection>

      <LegalSection id="publication" title="Directeur de la publication">
        <p>
          Directeur de la publication : <strong className="text-zinc-900 dark:text-white">{c.publisher}</strong>{" "}
          (également référent données personnelles / DPO opérationnel).
        </p>
        <p>
          E-mail DPO :{" "}
          <a className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" href={`mailto:${c.dpoEmail}`}>
            {c.dpoEmail}
          </a>
        </p>
      </LegalSection>

      <LegalSection id="hebergeur" title="Hébergeur">
        <p>
          <strong className="text-zinc-900 dark:text-white">{host.name}</strong>
          <br />
          {host.street}, {host.city}, {host.state} {host.postalCode}, {host.countryFr}
          <br />
          <a href={host.website} className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            {host.website.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p>
          Données applicatives : <strong className="text-zinc-900 dark:text-white">{secondary.name}</strong> —{" "}
          {secondary.roleFr} (
          <a href={secondary.website} className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            supabase.com
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection id="activite" title="Activité">
        <p>{AFFISELL_LEGAL_IDENTITY.activitySummary}</p>
      </LegalSection>

      <LegalSection id="ip" title="Propriété intellectuelle">
        <p>
          Marques, logos, textes, interfaces et éléments graphiques Affisell sont protégés. Toute reproduction non
          autorisée est interdite, hors exceptions légales.
        </p>
      </LegalSection>

      <LegalSection id="mediation" title="Médiation & litiges">
        <p>
          En cas de litige de consommation non résolu amiablement, vous pouvez saisir le médiateur{" "}
          <strong className="text-zinc-900 dark:text-white">{c.mediatorName}</strong> :{" "}
          <a href={c.mediatorUrl} className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            {c.mediatorUrl.replace(/^https?:\/\//, "")}
          </a>
          .
        </p>
        <p>
          Plateforme européenne de règlement en ligne des litiges (ODR) :{" "}
          <a href={c.odrUrl} className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300" target="_blank" rel="noreferrer">
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLaunchShell>
  )
}
