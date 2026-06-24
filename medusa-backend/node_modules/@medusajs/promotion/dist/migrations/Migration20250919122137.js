"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250919122137 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250919122137 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promotion_rule_attribute_operator_id" ON "promotion_rule" (operator, attribute, id) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_promotion_rule_attribute_operator_id";`);
    }
}
exports.Migration20250919122137 = Migration20250919122137;
//# sourceMappingURL=Migration20250919122137.js.map