"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250508081510 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250508081510 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "promotion" add column if not exists "is_tax_inclusive" boolean not null default false;`);
    }
    async down() {
        this.addSql(`alter table if exists "promotion" drop column if exists "is_tax_inclusive";`);
    }
}
exports.Migration20250508081510 = Migration20250508081510;
//# sourceMappingURL=Migration20250508081510.js.map