/**
 * Rayons type marketplace (FR) : chaque grand comptoir (index = ordre des racines seed)
 * possède des **allées** (catégories enfants) — même logique qu’Amazon « Department › Aisle ».
 * Les `slugKey` sont suffixés au slug racine pour garantir l’unicité globale (`slug` Prisma unique).
 */
export type DepartmentAisle = { name: string; slugKey: string; icon: string }

/** Index aligné sur `CATEGORIES` dans `prisma/seed.ts` (0 = Électronique, …). */
export const FR_DEPARTMENT_AISLES: readonly DepartmentAisle[][] = [
  [
    { name: "Mobiles & tablettes", slugKey: "mobiles-tablettes", icon: "📱" },
    { name: "Audio & casques", slugKey: "audio-casques", icon: "🎧" },
    { name: "Gaming & streaming", slugKey: "gaming-streaming", icon: "🎮" },
    { name: "Photo & vidéo", slugKey: "photo-video", icon: "📷" },
  ],
  [
    { name: "Chaussures", slugKey: "chaussures", icon: "👟" },
    { name: "Vêtements", slugKey: "vetements", icon: "👔" },
    { name: "Accessoires", slugKey: "accessoires", icon: "🧢" },
    { name: "Montres & lunettes", slugKey: "montres-lunettes", icon: "⌚" },
  ],
  [
    { name: "Mobilier", slugKey: "mobilier", icon: "🛋️" },
    { name: "Décoration", slugKey: "decoration", icon: "🖼️" },
    { name: "Cuisine & électroménager", slugKey: "cuisine-electro", icon: "🍳" },
    { name: "Entretien & jardin", slugKey: "entretien-jardin", icon: "🧹" },
  ],
  [
    { name: "Soins visage", slugKey: "soins-visage", icon: "🧴" },
    { name: "Parfums", slugKey: "parfums", icon: "💐" },
    { name: "Coiffure & styling", slugKey: "coiffure-styling", icon: "💇" },
  ],
  [
    { name: "Fitness", slugKey: "fitness", icon: "🏋️" },
    { name: "Outdoor & rando", slugKey: "outdoor-rando", icon: "⛰️" },
    { name: "Vélos & mobilité", slugKey: "velos-mobilite", icon: "🚴" },
  ],
  [
    { name: "PC & composants", slugKey: "pc-composants", icon: "🖥️" },
    { name: "Périphériques", slugKey: "peripheriques", icon: "⌨️" },
    { name: "Écrans & bureautique", slugKey: "ecrans-bureautique", icon: "🖱️" },
  ],
  [
    { name: "Poussettes & portage", slugKey: "poussettes-portage", icon: "👶" },
    { name: "Sièges auto", slugKey: "sieges-auto", icon: "🚙" },
    { name: "Chambre & repas", slugKey: "chambre-repas", icon: "🍼" },
  ],
  [
    { name: "Casques & protections", slugKey: "casques-protections", icon: "⛑️" },
    { name: "Équipement pilote", slugKey: "equipement-pilote", icon: "🧤" },
    { name: "Charge & entretien", slugKey: "charge-entretien", icon: "🔌" },
  ],
] as const
