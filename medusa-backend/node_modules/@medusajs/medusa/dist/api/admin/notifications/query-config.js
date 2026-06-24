"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminNotificationFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["notification"] = "notification";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminNotificationFields = [
    "id",
    "to",
    "channel",
    "template",
    "data",
    "trigger_type",
    "resource_id",
    "resource_type",
    "receiver_id",
    "created_at",
    "updated_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminNotificationFields,
    isList: false,
    entity: Entities.notification,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.notification,
};
//# sourceMappingURL=query-config.js.map