"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminSalesChannelFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["sales_channel"] = "sales_channel";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminSalesChannelFields = [
    "id",
    "name",
    "description",
    "is_disabled",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminSalesChannelFields,
    isList: false,
    entity: Entities.sales_channel,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.sales_channel,
};
//# sourceMappingURL=query-config.js.map