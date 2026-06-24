"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminCustomerGroupFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["customer_group"] = "customer_group";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminCustomerGroupFields = [
    "id",
    "name",
    "created_by",
    "created_at",
    "updated_at",
    "deleted_at",
    "metadata",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminCustomerGroupFields,
    isList: false,
    entity: Entities.customer_group,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.customer_group,
};
//# sourceMappingURL=query-config.js.map