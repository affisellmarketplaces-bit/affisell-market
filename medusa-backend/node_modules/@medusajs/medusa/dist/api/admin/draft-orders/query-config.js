"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminOrderFields = exports.defaultAdminListOrderFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["order"] = "order";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminListOrderFields = [
    "id",
    "display_id",
    "custom_display_id",
    "status",
    "version",
    "email",
    "region_id",
    "*items",
    "summary",
    "total",
    "metadata",
    "created_at",
    "updated_at",
];
exports.defaultAdminOrderFields = [
    "id",
    "display_id",
    "custom_display_id",
    "status",
    "version",
    "email",
    "region_id",
    "*items",
    "*items.tax_lines",
    "*items.adjustments",
    "*items.detail",
    "*items.variant",
    "*items.variant.product",
    "*shipping_address",
    "*billing_address",
    "*shipping_methods",
    "*shipping_methods.tax_lines",
    "*shipping_methods.adjustments",
    "summary",
    "total",
    "metadata",
    "created_at",
    "updated_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminOrderFields,
    isList: false,
    entity: Entities.order,
};
exports.listTransformQueryConfig = {
    defaults: exports.defaultAdminListOrderFields,
    defaultLimit: 20,
    isList: true,
    entity: Entities.order,
};
//# sourceMappingURL=query-config.js.map