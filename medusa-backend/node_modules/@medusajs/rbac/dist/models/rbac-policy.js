"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const RbacPolicy = utils_1.model
    .define("rbac_policy", {
    id: utils_1.model.id({ prefix: "rpol" }).primaryKey(),
    key: utils_1.model.text().searchable(),
    resource: utils_1.model.text().searchable(),
    operation: utils_1.model.text().searchable(),
    name: utils_1.model.text().searchable().nullable(),
    description: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    {
        on: ["key"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        on: ["resource"],
        where: "deleted_at IS NULL",
    },
    {
        on: ["operation"],
        where: "deleted_at IS NULL",
    },
]);
exports.default = RbacPolicy;
//# sourceMappingURL=rbac-policy.js.map