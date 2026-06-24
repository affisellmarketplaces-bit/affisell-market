"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminInviteFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["invite"] = "invite";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminInviteFields = [
    "id",
    "email",
    "accepted",
    "token",
    "expires_at",
    "metadata",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminInviteFields,
    isList: false,
    entity: Entities.invite,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.invite,
};
//# sourceMappingURL=query-config.js.map