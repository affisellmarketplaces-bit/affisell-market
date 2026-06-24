"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const rbac_role_parent_1 = __importDefault(require("./rbac-role-parent"));
const rbac_role_policy_1 = __importDefault(require("./rbac-role-policy"));
const RbacRole = utils_1.model
    .define("rbac_role", {
    id: utils_1.model.id({ prefix: "role" }).primaryKey(),
    name: utils_1.model.text().searchable(),
    description: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
    policies: utils_1.model.hasMany(() => rbac_role_policy_1.default, {
        mappedBy: "role",
    }),
    parents: utils_1.model.hasMany(() => rbac_role_parent_1.default, {
        mappedBy: "role",
    }),
})
    .indexes([
    {
        on: ["name"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
exports.default = RbacRole;
//# sourceMappingURL=rbac-role.js.map