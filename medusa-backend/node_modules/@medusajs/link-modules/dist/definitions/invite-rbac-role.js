"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteRbacRole = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.InviteRbacRole = {
    serviceName: utils_1.LINKS.InviteRbacRole,
    isLink: true,
    databaseConfig: {
        tableName: "invite_rbac_role",
        idPrefix: "inviterole",
    },
    alias: [
        {
            name: "invite_rbac_role",
        },
        {
            name: "invite_rbac_roles",
        },
    ],
    primaryKeys: ["id", "invite_id", "rbac_role_id"],
    relationships: [
        {
            serviceName: utils_1.Modules.USER,
            entity: "Invite",
            primaryKey: "id",
            foreignKey: "invite_id",
            alias: "invite",
            args: {
                methodSuffix: "Invites",
            },
            hasMany: true,
        },
        {
            serviceName: utils_1.Modules.RBAC,
            entity: "RbacRole",
            primaryKey: "id",
            foreignKey: "rbac_role_id",
            alias: "rbac_role",
            args: {
                methodSuffix: "RbacRoles",
            },
            hasMany: true,
        },
    ],
    extends: [
        {
            serviceName: utils_1.Modules.USER,
            entity: "Invite",
            fieldAlias: {
                rbac_roles: {
                    path: "rbac_roles_link.rbac_role",
                    isList: true,
                },
            },
            relationship: {
                serviceName: utils_1.LINKS.InviteRbacRole,
                primaryKey: "invite_id",
                foreignKey: "id",
                alias: "rbac_roles_link",
                isList: true,
            },
        },
        {
            serviceName: utils_1.Modules.RBAC,
            entity: "RbacRole",
            relationship: {
                serviceName: utils_1.LINKS.InviteRbacRole,
                primaryKey: "rbac_role_id",
                foreignKey: "id",
                alias: "invites_link",
                isList: true,
            },
        },
    ],
};
//# sourceMappingURL=invite-rbac-role.js.map