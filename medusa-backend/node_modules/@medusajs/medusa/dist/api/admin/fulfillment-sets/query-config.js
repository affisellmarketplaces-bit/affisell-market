"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveServiceZoneTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminFulfillmentSetsFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["fulfillment_set"] = "fulfillment_set";
    Entities["service_zone"] = "service_zone";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminFulfillmentSetsFields = [
    "id",
    "name",
    "type",
    "created_at",
    "updated_at",
    "deleted_at",
    "*service_zones",
    "*service_zones.geo_zones",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminFulfillmentSetsFields,
    isList: false,
    entity: Entities.fulfillment_set,
};
exports.retrieveServiceZoneTransformQueryConfig = {
    defaults: [
        "id",
        "name",
        "type",
        "created_at",
        "updated_at",
        "deleted_at",
        "*geo_zones",
    ],
    isList: false,
    entity: Entities.fulfillment_set,
};
//# sourceMappingURL=query-config.js.map