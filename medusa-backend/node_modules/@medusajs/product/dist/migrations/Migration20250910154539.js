"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250910154539 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250910154539 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_image_product_id" ON "image" (product_id) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_image_deleted_at" ON "image" (deleted_at) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_image_url" ON "image" (url) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_image_rank" ON "image" (rank) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_image_url_rank_product_id" ON "image" (url, rank, product_id) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_image_rank_product_id" ON "image" (rank, product_id) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_image_product_id";`);
        this.addSql(`drop index if exists "IDX_image_deleted_at";`);
        this.addSql(`drop index if exists "IDX_product_image_url";`);
        this.addSql(`drop index if exists "IDX_product_image_rank";`);
        this.addSql(`drop index if exists "IDX_product_image_url_rank_product_id";`);
        this.addSql(`drop index if exists "IDX_product_image_rank_product_id";`);
    }
}
exports.Migration20250910154539 = Migration20250910154539;
//# sourceMappingURL=Migration20250910154539.js.map