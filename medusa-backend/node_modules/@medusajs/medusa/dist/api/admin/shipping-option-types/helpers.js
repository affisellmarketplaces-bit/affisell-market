"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refetchShippingOptionType = void 0;
const utils_1 = require("@medusajs/framework/utils");
const refetchShippingOptionType = async (shippingOptionTypeId, scope, fields) => {
    const query = scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: shippingOptionTypes } = await query.graph({
        entity: "shipping_option_type",
        fields: fields,
        filters: { id: shippingOptionTypeId },
    });
    return shippingOptionTypes[0];
};
exports.refetchShippingOptionType = refetchShippingOptionType;
//# sourceMappingURL=helpers.js.map