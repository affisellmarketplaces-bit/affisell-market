"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250924135437 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
const ulid_1 = require("ulid");
class Migration20250924135437 extends migrations_1.Migration {
    async up() {
        const [existingReason] = await this.execute(`
      SELECT 1 as exists
      FROM "refund_reason"
      LIMIT 1
    `);
        if (!existingReason) {
            // 2. Create default shipping option type
            await this.execute(`
        INSERT INTO "refund_reason" (id, label, description)
        VALUES 
          ('refr_${(0, ulid_1.ulid)()}', 'Shipping Issue', 'Refund due to lost, delayed, or misdelivered shipment'),
          ('refr_${(0, ulid_1.ulid)()}', 'Customer Care Adjustment', 'Refund given as goodwill or compensation for inconvenience'),
          ('refr_${(0, ulid_1.ulid)()}', 'Pricing Error', 'Refund to correct an overcharge, missing discount, or incorrect price');
      `);
        }
    }
    async down() {
        // Remove the default refund reasons we created
        this.addSql(`
      DELETE FROM "refund_reason"
      WHERE ("label", "description") IN (
        ('Shipping Issue', 'Refund due to lost, delayed, or misdelivered shipment'),
        ('Customer Care Adjustment', 'Refund given as goodwill or compensation for inconvenience'),
        ('Pricing Error', 'Refund to correct an overcharge, missing discount, or incorrect price')
      )
    `);
    }
}
exports.Migration20250924135437 = Migration20250924135437;
//# sourceMappingURL=Migration20250924135437.js.map