-- Affisell additions to the Google taxonomy: modern product types (smartwatches, VR, drones, dashcams, power banks,
-- robot vacuums, smart locks…). Additive and idempotent; parents are found by fullPath, commission/attribute
-- inheritance follows parentId. Generated from lib/custom-taxonomy.ts (a test keeps both in sync).
INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-objets-connectes-et-realite-virtuelle-affisell', 'Objets connectés et réalité virtuelle', 'objets-connectes-et-realite-virtuelle-affisell', '📦', 910001, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Objets connectés et réalité virtuelle', false, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-montres-connectees-affisell', 'Montres connectées', 'montres-connectees-affisell', '📦', 910002, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Montres connectées', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques > Objets connectés et réalité virtuelle'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-bracelets-d-activite-connectes-affisell', 'Bracelets d''activité connectés', 'bracelets-d-activite-connectes-affisell', '📦', 910003, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Bracelets d''activité connectés', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques > Objets connectés et réalité virtuelle'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-casques-de-realite-virtuelle-affisell', 'Casques de réalité virtuelle', 'casques-de-realite-virtuelle-affisell', '📦', 910004, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Casques de réalité virtuelle', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques > Objets connectés et réalité virtuelle'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-lunettes-connectees-affisell', 'Lunettes connectées', 'lunettes-connectees-affisell', '📦', 910005, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Lunettes connectées', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques > Objets connectés et réalité virtuelle'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-drones-avec-camera-affisell', 'Drones avec caméra', 'drones-avec-camera-affisell', '📦', 910006, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Drones avec caméra', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils photo, caméras et instruments d''optique > Appareils photo et caméras'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-cameras-embarquees-dashcams-affisell', 'Caméras embarquées (dashcams)', 'cameras-embarquees-dashcams-affisell', '📦', 910007, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Caméras embarquées (dashcams)', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-chargeurs-de-voiture-et-adaptateurs-allume-cigare-affisell', 'Chargeurs de voiture et adaptateurs allume-cigare', 'chargeurs-de-voiture-et-adaptateurs-allume-cigare-affisell', '📦', 910008, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Chargeurs de voiture et adaptateurs allume-cigare', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-hoverboards-et-gyropodes-affisell', 'Hoverboards et gyropodes', 'hoverboards-et-gyropodes-affisell', '📦', 910009, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Hoverboards et gyropodes', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Équipements sportifs > Loisirs de plein air'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-batteries-externes-power-banks-affisell', 'Batteries externes (power banks)', 'batteries-externes-power-banks-affisell', '📦', 910010, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Batteries externes (power banks)', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Appareils électroniques > Accessoires électroniques > Alimentation'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-aspirateurs-robots-affisell', 'Aspirateurs robots', 'aspirateurs-robots-affisell', '📦', 910011, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Aspirateurs robots', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Maison et jardin > Appareils électroménagers'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-sonnettes-video-connectees-affisell', 'Sonnettes vidéo connectées', 'sonnettes-video-connectees-affisell', '📦', 910012, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Sonnettes vidéo connectées', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Maison et jardin > Sécurité à domicile et au bureau'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-serrures-connectees-affisell', 'Serrures connectées', 'serrures-connectees-affisell', '📦', 910013, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Serrures connectées', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Maison et jardin > Sécurité à domicile et au bureau'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT 'aff-cat-robots-patissiers-et-batteurs-affisell', 'Robots pâtissiers et batteurs', 'robots-patissiers-et-batteurs-affisell', '📦', 910014, p."id", p."level" + 1, p."fullPath" || ' > ' || 'Robots pâtissiers et batteurs', true, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = 'Maison et jardin > Arts de la table et arts culinaires > Électroménager de cuisine'
ON CONFLICT ("slug") DO NOTHING;
