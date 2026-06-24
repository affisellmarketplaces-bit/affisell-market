"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251010130829 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251010130829 extends migrations_1.Migration {
    async up() {
        this.addSql('DROP INDEX IF EXISTS "IDX_customer_group_name";');
    }
    async down() {
        this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_group_name" ON "customer_group" ("name") WHERE "deleted_at" IS NULL;');
    }
}
exports.Migration20251010130829 = Migration20251010130829;
//# sourceMappingURL=Migration20251010130829.js.map