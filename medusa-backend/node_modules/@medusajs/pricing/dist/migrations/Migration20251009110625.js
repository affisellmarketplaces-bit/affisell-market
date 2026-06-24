"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251009110625 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251009110625 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_list_id_status_starts_at_ends_at" ON "price_list" (id, status, starts_at, ends_at) WHERE deleted_at IS NULL AND status = 'active';`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_list_rule_value" ON "price_list_rule" USING gin (value) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_rule_attribute_value_price_id" ON "price_rule" (attribute, value, price_id) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_price_list_id_status_starts_at_ends_at";`);
        this.addSql(`drop index if exists "IDX_price_list_rule_value";`);
        this.addSql(`drop index if exists "IDX_price_rule_attribute_value_price_id";`);
    }
}
exports.Migration20251009110625 = Migration20251009110625;
//# sourceMappingURL=Migration20251009110625.js.map