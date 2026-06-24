"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251114133146 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251114133146 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_option_shipping_option_type_id" ON "shipping_option" ("shipping_option_type_id") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_shipping_option_shipping_option_type_id";`);
    }
}
exports.Migration20251114133146 = Migration20251114133146;
//# sourceMappingURL=Migration20251114133146.js.map