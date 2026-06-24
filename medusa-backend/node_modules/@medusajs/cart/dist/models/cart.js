"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const address_1 = __importDefault(require("./address"));
const credit_line_1 = __importDefault(require("./credit-line"));
const line_item_1 = __importDefault(require("./line-item"));
const shipping_method_1 = __importDefault(require("./shipping-method"));
/**
 * Represents a shopping cart containing items and associated data.
 */
const Cart = utils_1.model
    .define("Cart", {
    /**
     * The unique identifier of the cart.
     */
    id: utils_1.model.id({ prefix: "cart" }).primaryKey(),
    /**
     * The ID of the region the cart belongs to.
     */
    region_id: utils_1.model.text().nullable(),
    /**
     * The ID of the customer the cart belongs to.
     */
    customer_id: utils_1.model.text().nullable(),
    /**
     * The ID of the sales channel the cart is associated with.
     */
    sales_channel_id: utils_1.model.text().nullable(),
    /**
     * The email address associated with the cart.
     */
    email: utils_1.model.text().nullable(),
    /**
     * The currency code used for the cart.
     */
    currency_code: utils_1.model.text(),
    /**
     * The BCP 47 language tag code of the locale
     *
     * @since 2.12.3
     *
     * @example
     * "en-US"
     */
    locale: utils_1.model.text().nullable(),
    /**
     * Additional metadata for the cart.
     */
    metadata: utils_1.model.json().nullable(),
    /**
     * The timestamp when the cart was completed/converted to an order.
     */
    completed_at: utils_1.model.dateTime().nullable(),
    /**
     * The shipping address for the cart.
     */
    shipping_address: utils_1.model
        .hasOne(() => address_1.default, {
        mappedBy: undefined,
        foreignKey: true,
    })
        .nullable(),
    /**
     * The billing address for the cart.
     */
    billing_address: utils_1.model
        .hasOne(() => address_1.default, {
        mappedBy: undefined,
        foreignKey: true,
    })
        .nullable(),
    /**
     * The line items in the cart.
     */
    items: utils_1.model.hasMany(() => line_item_1.default, {
        mappedBy: "cart",
    }),
    /**
     * The credit lines associated with the cart.
     */
    credit_lines: utils_1.model.hasMany(() => credit_line_1.default, {
        mappedBy: "cart",
    }),
    /**
     * The shipping methods selected for the cart.
     */
    shipping_methods: utils_1.model.hasMany(() => shipping_method_1.default, {
        mappedBy: "cart",
    }),
    /**
     * The original total amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_total: utils_1.model.bigNumber().computed(),
    /**
     * The original subtotal amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The original tax total amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The total amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_total: utils_1.model.bigNumber().computed(),
    /**
     * The subtotal amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The tax total amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The original total amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_total: utils_1.model.bigNumber().computed(),
    /**
     * The original subtotal amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The original tax total amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The total amount of the cart after discounts.
     */
    total: utils_1.model.bigNumber().computed(),
    /**
     * The subtotal amount of the cart after discounts.
     */
    subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The tax total amount of the cart.
     */
    tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The total discount amount applied to the cart.
     */
    discount_total: utils_1.model.bigNumber().computed(),
    /**
     * The total tax amount on discounts applied to the cart.
     */
    discount_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The total gift card amount applied to the cart.
     */
    gift_card_total: utils_1.model.bigNumber().computed(),
    /**
     * The total tax amount on gift cards applied to the cart.
     */
    gift_card_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The total shipping amount for the cart.
     */
    shipping_total: utils_1.model.bigNumber().computed(),
    /**
     * The shipping subtotal amount for the cart.
     */
    shipping_subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The total tax amount on shipping for the cart.
     */
    shipping_tax_total: utils_1.model.bigNumber().computed(),
    /**
     * The original total shipping amount for the cart before discounts.
     */
    original_shipping_total: utils_1.model.bigNumber().computed(),
    /**
     * The original shipping subtotal amount for the cart before discounts.
     */
    original_shipping_subtotal: utils_1.model.bigNumber().computed(),
    /**
     * The original total tax amount on shipping for the cart before discounts.
     */
    original_shipping_tax_total: utils_1.model.bigNumber().computed(),
})
    .cascades({
    delete: [
        "items",
        "shipping_methods",
        "shipping_address",
        "billing_address",
    ],
})
    .indexes([
    {
        name: "IDX_cart_region_id",
        on: ["region_id"],
        where: "deleted_at IS NULL AND region_id IS NOT NULL",
    },
    {
        name: "IDX_cart_customer_id",
        on: ["customer_id"],
        where: "deleted_at IS NULL AND customer_id IS NOT NULL",
    },
    {
        name: "IDX_cart_sales_channel_id",
        on: ["sales_channel_id"],
        where: "deleted_at IS NULL AND sales_channel_id IS NOT NULL",
    },
    {
        name: "IDX_cart_curency_code",
        on: ["currency_code"],
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_cart_shipping_address_id",
        on: ["shipping_address_id"],
        where: "deleted_at IS NULL AND shipping_address_id IS NOT NULL",
    },
    {
        name: "IDX_cart_billing_address_id",
        on: ["billing_address_id"],
        where: "deleted_at IS NULL AND billing_address_id IS NOT NULL",
    },
]);
exports.default = Cart;
//# sourceMappingURL=cart.js.map