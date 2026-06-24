"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserRolesTransformQueryConfig = exports.defaultAdminUserRolesFields = exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminUserFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["user"] = "user";
    Entities["rbac_role"] = "rbac_role";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminUserFields = [
    "id",
    "first_name",
    "last_name",
    "email",
    "avatar_url",
    "metadata",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminUserFields,
    isList: false,
    entity: Entities.user,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.user,
};
exports.defaultAdminUserRolesFields = [
    "user_id",
    "rbac_role_id",
    "rbac_role.*",
];
exports.listUserRolesTransformQueryConfig = {
    defaults: exports.defaultAdminUserRolesFields,
    isList: true,
    entity: Entities.rbac_role,
};
//# sourceMappingURL=query-config.js.map