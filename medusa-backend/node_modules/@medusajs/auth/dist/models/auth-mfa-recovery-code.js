"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMfaRecoveryCode = void 0;
const utils_1 = require("@medusajs/framework/utils");
const auth_identity_1 = require("./auth-identity");
exports.AuthMfaRecoveryCode = utils_1.model
    .define("auth_mfa_recovery_code", {
    id: utils_1.model.id({ prefix: "authmfarec" }).primaryKey(),
    auth_identity: utils_1.model.belongsTo(() => auth_identity_1.AuthIdentity, {
        mappedBy: "mfa_recovery_codes",
    }),
    code_hash: utils_1.model.text(),
})
    .indexes([
    {
        name: "IDX_auth_mfa_recovery_code_auth_identity_id",
        on: ["auth_identity_id"],
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_auth_mfa_recovery_code_auth_identity_code_hash",
        on: ["auth_identity_id", "code_hash"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
//# sourceMappingURL=auth-mfa-recovery-code.js.map