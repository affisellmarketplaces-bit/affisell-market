"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250917143818 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250917143818 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promotion_is_automatic" ON "promotion" (is_automatic) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promotion_rule_value_rule_id_value" ON "promotion_rule_value" (promotion_rule_id, value) WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promotion_rule_value_value" ON "promotion_rule_value" (value) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_promotion_is_automatic";`);
        this.addSql(`drop index if exists "IDX_promotion_rule_value_rule_id_value";`);
        this.addSql(`drop index if exists "IDX_promotion_rule_value_value";`);
    }
}
exports.Migration20250917143818 = Migration20250917143818;
//# sourceMappingURL=Migration20250917143818.js.map