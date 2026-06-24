"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const utils_1 = require("@medusajs/framework/utils");
const POST = async (req, res) => {
    const authService = req.scope.resolve(utils_1.Modules.AUTH);
    const factors = await authService.listAuthMfa({
        auth_identity_id: req.auth_context.auth_identity_id,
        status: "enabled",
    });
    if (!factors.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Recovery codes require an enabled MFA factor");
    }
    const { codes } = await authService.generateAuthMfaRecoveryCodes({
        auth_identity_id: req.auth_context.auth_identity_id,
        count: req.validatedBody.count,
    });
    await req.scope.resolve(utils_1.Modules.EVENT_BUS).emit({
        name: utils_1.AuthEvents.MFA_RECOVERY_CODES_GENERATED,
        data: {
            auth_identity_id: req.auth_context.auth_identity_id,
            count: codes.length,
        },
    });
    return res.status(200).json({ recovery_codes: codes });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map