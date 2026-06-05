/** Motifs standard — documents non officiels / dossier incomplet. */
export const KYC_REJECTION_PRESETS = [
  {
    id: "non_official",
    label: "Document non officiel",
    message:
      "Le document fourni n'est pas une pièce officielle acceptée (CNI, passeport, Kbis, attestation URSSAF…). Merci de renvoyer un scan lisible du document original.",
  },
  {
    id: "expired",
    label: "Document expiré",
    message: "La pièce d'identité ou le Kbis est expiré ou date de plus de 3 mois. Merci de fournir un document en cours de validité.",
  },
  {
    id: "unreadable",
    label: "Illisible / recadrage",
    message: "Le fichier est flou, tronqué ou illisible. Reprenez une photo nette, sans reflet, sur fond neutre.",
  },
  {
    id: "name_mismatch",
    label: "Nom incohérent",
    message: "Le nom sur la pièce d'identité ne correspond pas au nom déclaré sur le dossier.",
  },
  {
    id: "siret_mismatch",
    label: "SIRET incohérent",
    message: "Le SIRET déclaré ne correspond pas au Kbis / attestation fournie.",
  },
  {
    id: "screenshot",
    label: "Capture d'écran refusée",
    message: "Les captures d'écran ne sont pas acceptées. Téléversez un scan ou une photo du document papier officiel.",
  },
] as const

export type KycRejectionPresetId = (typeof KYC_REJECTION_PRESETS)[number]["id"]
