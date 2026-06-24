"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251011090511 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251011090511 extends migrations_1.Migration {
    // UP: Fixes the bug by dropping the bad index from product_collection.
    async up() {
        this.addSql('DROP INDEX IF EXISTS "IDX_product_category_deleted_at";');
    }
    // DOWN: Reverts the fix by re-creating the original bug.
    async down() {
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_product_category_deleted_at" ON "product_collection" ("deleted_at");');
    }
}
exports.Migration20251011090511 = Migration20251011090511;
//# sourceMappingURL=Migration20251011090511.js.map