"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminApiKeyFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["api_key"] = "api_key";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminApiKeyFields = [
    "id",
    "title",
    "token",
    "redacted",
    "type",
    "last_used_at",
    "updated_at",
    "created_at",
    "created_by",
    "revoked_at",
    "revoked_by",
    "sales_channels.id",
    "sales_channels.name",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminApiKeyFields,
    isList: false,
    entity: Entities.api_key,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaultLimit: 20,
    isList: true,
    entity: Entities.api_key,
};
//# sourceMappingURL=query-config.js.map