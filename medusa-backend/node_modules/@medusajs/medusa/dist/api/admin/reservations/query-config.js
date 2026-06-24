"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminReservationFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["reservation_item"] = "reservation_item";
})(Entities || (exports.Entities = Entities = {}));
const query_config_1 = require("../inventory-items/query-config");
exports.defaultAdminReservationFields = [
    "id",
    "location_id",
    "inventory_item_id",
    "quantity",
    "line_item_id",
    "description",
    "metadata",
    "created_at",
    "updated_at",
    ...query_config_1.defaultAdminInventoryItemFields.map((f) => `inventory_item.${f}`),
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminReservationFields,
    isList: false,
    entity: Entities.reservation_item,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.reservation_item,
};
//# sourceMappingURL=query-config.js.map