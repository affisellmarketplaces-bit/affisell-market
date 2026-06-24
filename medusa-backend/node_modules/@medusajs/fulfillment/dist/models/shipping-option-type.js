"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingOptionType = void 0;
const utils_1 = require("@medusajs/framework/utils");
const shipping_option_1 = require("./shipping-option");
exports.ShippingOptionType = utils_1.model.define("shipping_option_type", {
    id: utils_1.model.id({ prefix: "sotype" }).primaryKey(),
    label: utils_1.model.text().searchable().translatable(),
    description: utils_1.model.text().searchable().translatable().nullable(),
    code: utils_1.model.text().searchable(),
    shipping_options: utils_1.model.hasMany(() => shipping_option_1.ShippingOption, {
        mappedBy: "type",
    }),
});
//# sourceMappingURL=shipping-option-type.js.map