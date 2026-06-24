"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251008132218 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251008132218 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "product_variant" add column if not exists "thumbnail" text null;`);
    }
    async down() {
        this.addSql(`alter table if exists "product_variant" drop column if exists "thumbnail";`);
    }
}
exports.Migration20251008132218 = Migration20251008132218;
//# sourceMappingURL=Migration20251008132218.js.map