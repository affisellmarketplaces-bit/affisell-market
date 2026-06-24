"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260429163502 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260429163502 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "price_list" add column if not exists "metadata" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "price_list" drop column if exists "metadata";`);
    }
}
exports.Migration20260429163502 = Migration20260429163502;
//# sourceMappingURL=Migration20260429163502.js.map