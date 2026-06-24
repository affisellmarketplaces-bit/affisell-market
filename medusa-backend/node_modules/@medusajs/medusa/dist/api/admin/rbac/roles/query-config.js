"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoleUsersTransformQueryConfig = exports.defaultAdminRoleUsersFields = exports.listRolePoliciesTransformQueryConfig = exports.retrieveRolePoliciesTransformQueryConfig = exports.defaultAdminRolePoliciesFields = exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminRbacRoleFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["user"] = "user";
    Entities["rbac_role"] = "rbac_role";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminRbacRoleFields = [
    "id",
    "name",
    "parent_id",
    "description",
    "metadata",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminRbacRoleFields,
    isList: false,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaultLimit: 20,
    isList: true,
};
exports.defaultAdminRolePoliciesFields = [
    "id",
    "role_id",
    "policy_id",
    "policy",
    "metadata",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveRolePoliciesTransformQueryConfig = {
    defaults: exports.defaultAdminRolePoliciesFields,
    isList: false,
};
exports.listRolePoliciesTransformQueryConfig = {
    ...exports.retrieveRolePoliciesTransformQueryConfig,
    isList: true,
};
exports.defaultAdminRoleUsersFields = ["user_id", "rbac_role_id", "user.*"];
exports.listRoleUsersTransformQueryConfig = {
    defaults: exports.defaultAdminRoleUsersFields,
    isList: true,
};
//# sourceMappingURL=query-config.js.map