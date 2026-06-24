"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTransformQueryConfig = exports.defaultAdminExportOrderFields = exports.listShippingOptionsQueryConfig = exports.listOrderItemsQueryConfig = exports.retrieveOrderChangesTransformQueryConfig = exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminOrderItemsFields = exports.defaultAdminRetrieveOrderChangesFields = exports.defaultAdminRetrieveOrderFields = exports.defaultAdminOrderFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["order"] = "order";
    Entities["fulfillment"] = "fulfillment";
    Entities["credit_line"] = "credit_line";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminOrderFields = [
    "id",
    "display_id",
    "custom_display_id",
    "status",
    "version",
    "summary",
    "total",
    "metadata",
    "locale",
    "created_at",
    "updated_at",
];
exports.defaultAdminRetrieveOrderFields = [
    ...exports.defaultAdminOrderFields,
    "region_id",
    "total",
    "subtotal",
    "tax_total",
    "discount_total",
    "discount_tax_total",
    "original_total",
    "original_subtotal",
    "original_tax_total",
    "item_total",
    "item_subtotal",
    "item_tax_total",
    "original_item_total",
    "original_item_subtotal",
    "original_item_tax_total",
    "shipping_total",
    "shipping_subtotal",
    "shipping_tax_total",
    "original_shipping_tax_total",
    "original_shipping_subtotal",
    "original_shipping_total",
    "credit_line_total",
    "credit_line_subtotal",
    "credit_line_tax_total",
    "*items",
    "*credit_lines",
    "*items.tax_lines",
    "*items.adjustments",
    "*items.variant",
    "*items.variant.product",
    "*items.detail",
    "*shipping_address",
    "*billing_address",
    "*shipping_methods",
    "*shipping_methods.tax_lines",
    "*shipping_methods.adjustments",
    "*payment_collections",
    "*payment_collections.payments",
    "*payment_collections.payments.refunds",
    "*payment_collections.payments.captures",
];
exports.defaultAdminRetrieveOrderChangesFields = [
    "id",
    "order_id",
    "return_id",
    "claim_id",
    "exchange_id",
    "version",
    "change_type",
    "*actions",
    "description",
    "status",
    "internal_note",
    "created_by",
    "requested_by",
    "requested_at",
    "confirmed_by",
    "confirmed_at",
    "declined_by",
    "declined_reason",
    "metadata",
    "declined_at",
    "canceled_by",
    "canceled_at",
    "created_at",
    "updated_at",
    "carry_over_promotions",
];
exports.defaultAdminOrderItemsFields = [
    "id",
    "order_id",
    "item_id",
    "version",
    "*item",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminRetrieveOrderFields,
    isList: false,
    entity: Entities.order,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminOrderFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.order,
};
exports.retrieveOrderChangesTransformQueryConfig = {
    defaults: exports.defaultAdminRetrieveOrderChangesFields,
    isList: false,
};
exports.listOrderItemsQueryConfig = {
    defaults: exports.defaultAdminOrderItemsFields,
    defaultLimit: 100,
    isList: true,
};
exports.listShippingOptionsQueryConfig = {
    defaultLimit: 100,
    isList: true,
};
exports.defaultAdminExportOrderFields = [
    "id",
    "display_id",
    "status",
    "created_at",
    "updated_at",
    "email",
    "currency_code",
    "region_id",
    "subtotal",
    "tax_total",
    "shipping_total",
    "discount_total",
    "gift_card_total",
    "total",
    "*customer",
    "*shipping_address",
    "*billing_address",
    "*sales_channel",
    "*items",
    "*shipping_methods",
    "*payment_collections",
    "*fulfillments",
];
exports.exportTransformQueryConfig = {
    defaults: exports.defaultAdminExportOrderFields,
    isList: true,
    entity: Entities.order,
};
//# sourceMappingURL=query-config.js.map