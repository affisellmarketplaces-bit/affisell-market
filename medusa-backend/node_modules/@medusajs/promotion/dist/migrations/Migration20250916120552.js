"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250916120552 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250916120552 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promotion_rule_attribute_operator" ON "promotion_rule" (attribute, operator) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_promotion_rule_attribute_operator";`);
    }
}
exports.Migration20250916120552 = Migration20250916120552;
//# sourceMappingURL=Migration20250916120552.js.map