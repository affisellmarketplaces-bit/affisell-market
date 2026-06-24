"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartShippingOption = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.CartShippingOption = {
    isLink: true,
    isReadOnlyLink: true,
    extends: [
        {
            serviceName: utils_1.Modules.CART,
            entity: "ShippingMethod",
            relationship: {
                serviceName: utils_1.Modules.FULFILLMENT,
                primaryKey: "id",
                foreignKey: "shipping_option_id",
                alias: "shipping_option",
                args: {
                    methodSuffix: "ShippingOptions",
                },
            },
        },
    ],
};
//# sourceMappingURL=cart-shipping-option.js.map