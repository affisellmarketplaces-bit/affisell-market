"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251225120947 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251225120947 extends migrations_1.Migration {
    async up() {
        this.addSql(`
      ALTER TABLE "order"
        DROP CONSTRAINT IF EXISTS "order_shipping_address_id_foreign";

      ALTER TABLE "order"
        ADD CONSTRAINT "order_shipping_address_id_foreign"
        FOREIGN KEY ("shipping_address_id")
        REFERENCES "order_address" ("id")
        ON UPDATE CASCADE
        ON DELETE SET NULL;  

      ALTER TABLE "order"
        DROP CONSTRAINT IF EXISTS "order_billing_address_id_foreign";

      ALTER TABLE "order"
        ADD CONSTRAINT "order_billing_address_id_foreign"
        FOREIGN KEY ("billing_address_id")
        REFERENCES "order_address" ("id")
        ON UPDATE CASCADE
        ON DELETE SET NULL;  
    `);
    }
    async down() {
        this.addSql(`
      ALTER TABLE "order"
        DROP CONSTRAINT IF EXISTS "order_shipping_address_id_foreign";

      ALTER TABLE "order"
        ADD CONSTRAINT "order_shipping_address_id_foreign"
        FOREIGN KEY ("shipping_address_id")
        REFERENCES "order_address" ("id")
        ON UPDATE CASCADE
        ON DELETE CASCADE;

      ALTER TABLE "order"
        DROP CONSTRAINT IF EXISTS "order_billing_address_id_foreign";

      ALTER TABLE "order"
        ADD CONSTRAINT "order_billing_address_id_foreign"
        FOREIGN KEY ("billing_address_id")
        REFERENCES "order_address" ("id")
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    `);
    }
}
exports.Migration20251225120947 = Migration20251225120947;
//# sourceMappingURL=Migration20251225120947.js.map