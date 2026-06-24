"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251006000000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251006000000 extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE "promotion_application_method" DROP CONSTRAINT IF EXISTS "promotion_application_method_allocation_check";`);
        this.addSql(`ALTER TABLE "promotion_application_method" ADD CONSTRAINT "promotion_application_method_allocation_check" CHECK ("allocation" IN ('each', 'across', 'once'));`);
    }
    async down() {
        this.addSql(`ALTER TABLE "promotion_application_method" DROP CONSTRAINT IF EXISTS "promotion_application_method_allocation_check";`);
        this.addSql(`ALTER TABLE "promotion_application_method" ADD CONSTRAINT "promotion_application_method_allocation_check" CHECK ("allocation" IN ('each', 'across'));`);
    }
}
exports.Migration20251006000000 = Migration20251006000000;
//# sourceMappingURL=Migration20251006000000.js.map