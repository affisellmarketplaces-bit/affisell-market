"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminFulfillmentProvidersFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["fulfillment_provider"] = "fulfillment_provider";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminFulfillmentProvidersFields = ["id", "is_enabled"];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminFulfillmentProvidersFields,
    isList: false,
    entity: Entities.fulfillment_provider,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.fulfillment_provider,
};
//# sourceMappingURL=query-config.js.map