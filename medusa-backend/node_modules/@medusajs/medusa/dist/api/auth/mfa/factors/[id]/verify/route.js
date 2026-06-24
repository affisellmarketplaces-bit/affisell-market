"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const utils_1 = require("@medusajs/framework/utils");
const POST = async (req, res) => {
    const { id } = req.params;
    const authService = req.scope.resolve(utils_1.Modules.AUTH);
    // Capture the previous status to emit the lifecycle event only on transition.
    const factor = await authService.retrieveAuthMfa({
        id,
        auth_identity_id: req.auth_context.auth_identity_id,
    });
    const verifiedFactor = await authService.verifyAuthMfa({
        id,
        auth_identity_id: req.auth_context.auth_identity_id,
        code: req.validatedBody.code,
    });
    if (factor.status !== "enabled" && verifiedFactor.status === "enabled") {
        await req.scope.resolve(utils_1.Modules.EVENT_BUS).emit({
            name: utils_1.AuthEvents.MFA_ENABLED,
            data: {
                auth_identity_id: verifiedFactor.auth_identity_id,
                mfa_id: verifiedFactor.id,
                provider: verifiedFactor.provider,
            },
        });
    }
    return res.status(200).json({ mfa_factor: verifiedFactor });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map