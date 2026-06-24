"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const rbac_role_1 = __importDefault(require("./rbac-role"));
const RbacRoleInheritance = utils_1.model
    .define("rbac_role_inheritance", {
    id: utils_1.model.id({ prefix: "rlin" }).primaryKey(),
    role: utils_1.model.belongsTo(() => rbac_role_1.default, { mappedBy: "inherited_roles" }),
    inherited_role: utils_1.model.belongsTo(() => rbac_role_1.default, {
        mappedBy: "inheritedBy",
    }),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    {
        on: ["role_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["inherited_role_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["role_id", "inherited_role_id"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
exports.default = RbacRoleInheritance;
//# sourceMappingURL=rbac-role-inheritance.js.map