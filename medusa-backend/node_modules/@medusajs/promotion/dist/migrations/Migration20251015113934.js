"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251015113934 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251015113934 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "promotion" add column if not exists "limit" integer null, add column if not exists "used" integer not null default 0;`);
    }
    async down() {
        this.addSql(`alter table if exists "promotion" drop column if exists "limit", drop column if exists "used";`);
    }
}
exports.Migration20251015113934 = Migration20251015113934;
//# sourceMappingURL=Migration20251015113934.js.map