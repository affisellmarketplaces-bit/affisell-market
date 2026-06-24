"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250522181137 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250522181137 extends migrations_1.Migration {
    async up() {
        this.addSql(`DELETE FROM "order_summary" WHERE "order_id" NOT IN (SELECT id FROM "order");`);
        this.addSql(`ALTER TABLE "order_summary" 
        ADD CONSTRAINT 
          "order_summary_order_id_foreign" FOREIGN KEY ("order_id") REFERENCES "order" ("id") 
        ON UPDATE CASCADE 
        ON DELETE CASCADE;`);
    }
    async down() {
        this.addSql(`ALTER TABLE "order_summary" DROP CONSTRAINT IF EXISTS "order_summary_order_id_foreign";`);
    }
}
exports.Migration20250522181137 = Migration20250522181137;
//# sourceMappingURL=Migration20250522181137.js.map