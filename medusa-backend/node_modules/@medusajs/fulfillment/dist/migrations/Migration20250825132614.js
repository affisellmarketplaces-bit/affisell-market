"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250825132614 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
const ulid_1 = require("ulid");
class Migration20250825132614 extends migrations_1.Migration {
    async up() {
        // 1. Find all type-code shipping option types
        const typeCodeTypeIds = await this.execute(`
      SELECT id FROM "shipping_option_type"
      WHERE code = 'type-code' AND deleted_at IS NULL
    `);
        if (typeCodeTypeIds.length > 0) {
            const defaultTypeId = `sotype_${(0, ulid_1.ulid)()}`;
            // 2. Create default shipping option type
            await this.execute(`
        INSERT INTO "shipping_option_type" (id, label, description, code)
        VALUES ('${defaultTypeId}', 'Default', 'Default shipping option type', 'default');
      `);
            const typeIdsString = typeCodeTypeIds
                .map((row) => `'${row.id}'`)
                .join(",");
            // 3. Reassign shipping options to the default type
            await this.execute(`
        UPDATE "shipping_option" 
        SET shipping_option_type_id = '${defaultTypeId}'
        WHERE shipping_option_type_id IN (${typeIdsString}) AND deleted_at IS NULL;
      `);
            // 4. Soft delete the old type-code types
            await this.execute(`
        UPDATE "shipping_option_type" 
        SET deleted_at = now()
        WHERE id IN (${typeIdsString});
      `);
        }
    }
    async down() {
        // Not reversible: would require restoring old type-code types + reassignment
    }
}
exports.Migration20250825132614 = Migration20250825132614;
//# sourceMappingURL=Migration20250825132614.js.map