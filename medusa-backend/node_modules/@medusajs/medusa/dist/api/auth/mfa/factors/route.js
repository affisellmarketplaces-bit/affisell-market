"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const authService = req.scope.resolve(utils_1.Modules.AUTH);
    const mfaFactors = await authService.listAuthMfa({
        auth_identity_id: req.auth_context.auth_identity_id,
    });
    return res.status(200).json({ mfa_factors: mfaFactors });
};
exports.GET = GET;
const POST = async (req, res) => {
    const authService = req.scope.resolve(utils_1.Modules.AUTH);
    const enrollment = await authService.startAuthMfa({
        auth_identity_id: req.auth_context.auth_identity_id,
        provider: req.validatedBody.provider,
        label: req.validatedBody.label,
        issuer: req.validatedBody.issuer,
        metadata: req.validatedBody.metadata,
    });
    return res.status(200).json({
        mfa_factor: enrollment.mfa,
        secret: enrollment.secret,
        otpauth_url: enrollment.otpauth_url,
    });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map