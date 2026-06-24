"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251028172715 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251028172715 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "notification" alter column "template" type text using ("template"::text);`);
        this.addSql(`alter table if exists "notification" alter column "template" drop not null;`);
    }
    async down() {
        this.addSql(`alter table if exists "notification" alter column "template" type text using ("template"::text);`);
        this.addSql(`alter table if exists "notification" alter column "template" set not null;`);
    }
}
exports.Migration20251028172715 = Migration20251028172715;
//# sourceMappingURL=Migration20251028172715.js.map