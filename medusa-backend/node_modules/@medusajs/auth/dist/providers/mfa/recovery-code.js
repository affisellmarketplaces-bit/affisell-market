"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryCodeMfaProvider = void 0;
const mfa_1 = require("../../utils/mfa");
class RecoveryCodeMfaProvider {
    constructor({ authMfaRecoveryCodeService }) {
        this.method = RecoveryCodeMfaProvider.identifier;
        this.authMfaRecoveryCodeService_ = authMfaRecoveryCodeService;
    }
    async canVerifyForAuthIdentity(data, sharedContext = {}) {
        const [code] = await this.authMfaRecoveryCodeService_.list({
            auth_identity_id: data.auth_identity_id,
        }, { select: ["id"] }, sharedContext);
        return !!code;
    }
    async generateCodes(data, sharedContext = {}) {
        const existingCodes = await this.authMfaRecoveryCodeService_.list({ auth_identity_id: data.auth_identity_id }, { select: ["id"] }, sharedContext);
        if (existingCodes.length) {
            await this.authMfaRecoveryCodeService_.delete(existingCodes.map((code) => code.id), sharedContext);
        }
        const codes = Array.from({ length: data.count }, () => (0, mfa_1.generateRecoveryCode)());
        await this.authMfaRecoveryCodeService_.create(await Promise.all(codes.map(async (code) => ({
            auth_identity_id: data.auth_identity_id,
            code_hash: await (0, mfa_1.hashRecoveryCode)(code),
        }))), sharedContext);
        return codes;
    }
    async verify(data, sharedContext = {}) {
        const recoveryCodes = await this.authMfaRecoveryCodeService_.list({
            auth_identity_id: data.auth_identity_id,
        }, { select: ["id", "code_hash"] }, sharedContext);
        let recoveryCode;
        for (const candidate of recoveryCodes) {
            if (await (0, mfa_1.verifyRecoveryCodeHash)(candidate.code_hash, data.code)) {
                recoveryCode = candidate;
                break;
            }
        }
        if (!recoveryCode) {
            return false;
        }
        await this.authMfaRecoveryCodeService_.delete(recoveryCode.id, sharedContext);
        return true;
    }
}
exports.RecoveryCodeMfaProvider = RecoveryCodeMfaProvider;
RecoveryCodeMfaProvider.identifier = "recovery_code";
//# sourceMappingURL=recovery-code.js.map