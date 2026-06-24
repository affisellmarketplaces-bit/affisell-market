"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251208130704 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251208130704 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "cart" add column if not exists "locale" text null;`);
    }
    async down() {
        this.addSql(`alter table if exists "cart" drop column if exists "locale";`);
    }
}
exports.Migration20251208130704 = Migration20251208130704;
//# sourceMappingURL=Migration20251208130704.js.map