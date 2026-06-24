"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260224120000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260224120000 extends migrations_1.Migration {
    async up() {
        this.addSql('ALTER TABLE IF EXISTS "product_category" ADD COLUMN IF NOT EXISTS "external_id" text NULL;');
    }
    async down() {
        this.addSql('ALTER TABLE IF EXISTS "product_category" DROP COLUMN IF EXISTS "external_id";');
    }
}
exports.Migration20260224120000 = Migration20260224120000;
//# sourceMappingURL=Migration20260224120000.js.map