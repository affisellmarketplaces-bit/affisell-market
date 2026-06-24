"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251010131115 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251010131115 extends migrations_1.Migration {
    async up() {
        this.addSql('DROP INDEX IF EXISTS "IDX_inventory_level_item_location";');
    }
    async down() {
        this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_level_item_location" ON "inventory_level" (inventory_item_id, location_id) WHERE deleted_at IS NULL;');
    }
}
exports.Migration20251010131115 = Migration20251010131115;
//# sourceMappingURL=Migration20251010131115.js.map