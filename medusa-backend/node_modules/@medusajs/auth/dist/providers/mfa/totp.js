"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TotpMfaProvider = void 0;
const utils_1 = require("@medusajs/framework/utils");
const mfa_1 = require("../../utils/mfa");
const totp_1 = require("../../utils/totp");
class TotpMfaProvider {
    constructor({ baseRepository, authMfaFactorService }, options_ = {}) {
        this.options_ = options_;
        this.method = TotpMfaProvider.identifier;
        this.baseRepository_ = baseRepository;
        this.authMfaFactorService_ = authMfaFactorService;
    }
    async canVerifyForAuthIdentity(data, sharedContext = {}) {
        const [factor] = await this.authMfaFactorService_.list({
            auth_identity_id: data.auth_identity_id,
            provider: this.method,
            status: "enabled",
        }, { select: ["id"] }, sharedContext);
        return !!factor;
    }
    async start(data, sharedContext = {}) {
        const totpConfig = this.getTotpConfig_();
        const issuer = data.issuer ?? totpConfig.issuer;
        const existingFactors = await this.authMfaFactorService_.list({
            auth_identity_id: data.auth_identity_id,
            provider: this.method,
            status: ["pending", "enabled"],
        }, { select: ["id"] }, sharedContext);
        if (existingFactors.length) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "An active TOTP factor already exists for this auth identity");
        }
        const secret = (0, totp_1.generateTotpSecret)();
        const factor = await this.authMfaFactorService_.create({
            auth_identity_id: data.auth_identity_id,
            provider: this.method,
            status: "pending",
            provider_metadata: {
                secret: (0, mfa_1.encryptSecret)(secret, this.getEncryptionKey_()),
                issuer,
            },
            metadata: {
                ...(data.metadata ?? {}),
                label: data.label ?? undefined,
            },
        }, sharedContext);
        return {
            mfa: await this.serializeFactor_(factor),
            secret,
            otpauth_url: (0, totp_1.generateTotpUri)({
                issuer,
                accountName: data.label ?? data.auth_identity_id,
                secret,
                digits: totpConfig.digits,
                period: totpConfig.period,
            }),
        };
    }
    async verifySetup(data, sharedContext = {}) {
        const factor = await this.authMfaFactorService_.retrieve(data.id, {}, sharedContext);
        if (factor.provider !== this.method) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Only TOTP MFA factors can be verified with this method");
        }
        if (factor.status === "disabled") {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Disabled MFA factors cannot be verified");
        }
        const valid = this.verifyCode_(factor, data.code);
        if (!valid) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Invalid TOTP code");
        }
        const verifiedFactor = factor.status === "pending"
            ? await this.authMfaFactorService_.update({ id: factor.id, status: "enabled" }, sharedContext)
            : factor;
        return await this.serializeFactor_(verifiedFactor);
    }
    async verify(data, sharedContext = {}) {
        const [factor] = await this.authMfaFactorService_.list({
            auth_identity_id: data.auth_identity_id,
            provider: this.method,
            status: "enabled",
        }, {}, sharedContext);
        return factor ? this.verifyCode_(factor, data.code) : false;
    }
    async serializeFactor_(factor) {
        const serialized = await this.baseRepository_.serialize(factor);
        delete serialized.provider_metadata;
        return serialized;
    }
    verifyCode_(factor, code) {
        const totpConfig = this.getTotpConfig_();
        const secret = (0, mfa_1.decryptSecret)(factor.provider_metadata?.secret, this.getEncryptionKey_());
        return (0, totp_1.verifyTotpCode)({
            secret,
            code,
            digits: totpConfig.digits,
            period: totpConfig.period,
            window: totpConfig.window,
        });
    }
    getEncryptionKey_() {
        const encryptionKey = this.options_?.encryption_key;
        if (!encryptionKey) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "MFA encryption key is required to use MFA methods");
        }
        return encryptionKey;
    }
    getTotpConfig_() {
        const config = {
            issuer: this.options_?.issuer ?? "Medusa",
            digits: this.options_?.digits ?? 6,
            period: this.options_?.period ?? 30,
            window: this.options_?.window ?? 1,
        };
        if (![6, 7, 8].includes(config.digits)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "TOTP digits must be 6, 7, or 8");
        }
        if (!Number.isInteger(config.period) || config.period < 1) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "TOTP period must be a positive integer");
        }
        if (!Number.isInteger(config.window) || config.window < 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "TOTP window must be a non-negative integer");
        }
        return config;
    }
}
exports.TotpMfaProvider = TotpMfaProvider;
TotpMfaProvider.identifier = "totp";
//# sourceMappingURL=totp.js.map