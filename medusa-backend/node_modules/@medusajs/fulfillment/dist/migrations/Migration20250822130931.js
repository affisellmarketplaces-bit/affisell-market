"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250822130931 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20250822130931 extends migrations_1.Migration {
    async up() {
        'alter table if exists "shipping_option" drop constraint if exists "shipping_option_shipping_option_type_id_foreign", add constraint "shipping_option_shipping_option_type_id_foreign" foreign key ("shipping_option_type_id") references "shipping_option_type" ("id") on update cascade;';
    }
    async down() { }
}
exports.Migration20250822130931 = Migration20250822130931;
//# sourceMappingURL=Migration20250822130931.js.map