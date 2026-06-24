"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderShippingMethodAdjustment = void 0;
const utils_1 = require("@medusajs/framework/utils");
const shipping_method_1 = require("./shipping-method");
const _OrderShippingMethodAdjustment = utils_1.model
    .define({
    tableName: "order_shipping_method_adjustment",
    name: "OrderShippingMethodAdjustment",
}, {
    id: utils_1.model.id({ prefix: "ordsmadj" }).primaryKey(),
    version: utils_1.model.number().default(1),
    description: utils_1.model.text().nullable(),
    promotion_id: utils_1.model.text().nullable(),
    code: utils_1.model.text().nullable(),
    amount: utils_1.model.bigNumber(),
    provider_id: utils_1.model.text().nullable(),
    shipping_method: utils_1.model.belongsTo(() => shipping_method_1.OrderShippingMethod, {
        mappedBy: "adjustments",
    }),
})
    .indexes([
    {
        name: "IDX_order_shipping_method_adjustment_shipping_method_id",
        on: ["shipping_method_id"],
        unique: false,
    },
    {
        name: "IDX_order_shipping_method_adjustment_version_shipping_method",
        on: ["version", "shipping_method_id"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
/**
 * The Order Shipping Method Adjustment data model. This model represents adjustments applied to
 * order shipping methods, such as promotions or discounts.
 *
 * @since 2.13.7
 */
exports.OrderShippingMethodAdjustment = _OrderShippingMethodAdjustment;
//# sourceMappingURL=shipping-method-adjustment.js.map