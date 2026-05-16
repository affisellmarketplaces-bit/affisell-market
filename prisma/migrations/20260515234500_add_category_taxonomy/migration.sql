-- Grand comptoir: specs sur Category + défaut isLeaf pour nouvelles lignes

ALTER TABLE "Category" ADD COLUMN "specs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Category" ALTER COLUMN "isLeaf" SET DEFAULT false;
