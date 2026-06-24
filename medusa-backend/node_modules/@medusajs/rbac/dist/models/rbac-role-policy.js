"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const rbac_policy_1 = __importDefault(require("./rbac-policy"));
const rbac_role_1 = __importDefault(require("./rbac-role"));
const RbacRolePolicy = utils_1.model
    .define("rbac_role_policy", {
    id: utils_1.model.id({ prefix: "rlpl" }).primaryKey(),
    role: utils_1.model.belongsTo(() => rbac_role_1.default),
    policy: utils_1.model.belongsTo(() => rbac_policy_1.default),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    {
        on: ["role_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["policy_id"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["role_id", "policy_id"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
exports.default = RbacRolePolicy;
//# sourceMappingURL=rbac-role-policy.js.map