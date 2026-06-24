"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251121123942 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251121123942 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "notification" add column if not exists "from" text null;`);
    }
    async down() {
        this.addSql(`alter table if exists "notification" drop column if exists "from";`);
    }
}
exports.Migration20251121123942 = Migration20251121123942;
//# sourceMappingURL=Migration20251121123942.js.map