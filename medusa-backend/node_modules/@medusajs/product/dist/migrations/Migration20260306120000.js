"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260306120000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260306120000 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "product_tag" add column if not exists "external_id" text null;`);
        this.addSql(`alter table if exists "product_collection" add column if not exists "external_id" text null;`);
        this.addSql(`alter table if exists "product_type" add column if not exists "external_id" text null;`);
    }
    async down() {
        this.addSql(`alter table if exists "product_tag" drop column if exists "external_id";`);
        this.addSql(`alter table if exists "product_collection" drop column if exists "external_id";`);
        this.addSql(`alter table if exists "product_type" drop column if exists "external_id";`);
    }
}
exports.Migration20260306120000 = Migration20260306120000;
//# sourceMappingURL=Migration20260306120000.js.map