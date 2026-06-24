"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250911092221 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250911092221 extends migrations_1.Migration {
    async up() {
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_status" ON "product" (status) WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_product_status";`);
    }
}
exports.Migration20250911092221 = Migration20250911092221;
//# sourceMappingURL=Migration20250911092221.js.map