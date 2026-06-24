"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250516081326 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250516081326 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_variant_id_product_id" ON "product_variant" (id, product_id) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_product_variant_id_product_id";`);
    }
}
exports.Migration20250516081326 = Migration20250516081326;
//# sourceMappingURL=Migration20250516081326.js.map