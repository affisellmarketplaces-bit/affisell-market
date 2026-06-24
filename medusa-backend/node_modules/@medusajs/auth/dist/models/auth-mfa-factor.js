"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMfaFactor = void 0;
const utils_1 = require("@medusajs/framework/utils");
const auth_identity_1 = require("./auth-identity");
exports.AuthMfaFactor = utils_1.model
    .define("auth_mfa_factor", {
    id: utils_1.model.id({ prefix: "authmfa" }).primaryKey(),
    auth_identity: utils_1.model.belongsTo(() => auth_identity_1.AuthIdentity, {
        mappedBy: "mfa_factors",
    }),
    provider: utils_1.model.text(),
    status: utils_1.model.text(),
    provider_metadata: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    {
        name: "IDX_auth_mfa_factor_auth_identity_id",
        on: ["auth_identity_id"],
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_auth_mfa_factor_auth_identity_provider_active",
        on: ["auth_identity_id", "provider"],
        unique: true,
        where: "deleted_at IS NULL AND status IN ('pending', 'enabled')",
    },
]);
//# sourceMappingURL=auth-mfa-factor.js.map