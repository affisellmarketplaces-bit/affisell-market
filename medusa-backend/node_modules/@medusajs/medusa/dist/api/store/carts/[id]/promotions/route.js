"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const helpers_1 = require("../../helpers");
const POST = async (req, res) => {
    const we = req.scope.resolve(utils_1.Modules.WORKFLOW_ENGINE);
    const payload = req.validatedBody;
    await we.run(core_flows_1.updateCartPromotionsWorkflowId, {
        input: {
            promo_codes: payload.promo_codes,
            cart_id: req.params.id,
            action: payload.promo_codes.length > 0
                ? utils_1.PromotionActions.ADD
                : utils_1.PromotionActions.REPLACE,
            force_refresh_payment_collection: true,
        },
    });
    const cart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({ cart });
};
exports.POST = POST;
const DELETE = async (req, res) => {
    const we = req.scope.resolve(utils_1.Modules.WORKFLOW_ENGINE);
    const payload = req.validatedBody;
    await we.run(core_flows_1.updateCartPromotionsWorkflowId, {
        input: {
            promo_codes: payload.promo_codes,
            cart_id: req.params.id,
            action: utils_1.PromotionActions.REMOVE,
            force_refresh_payment_collection: true,
        },
    });
    const cart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({ cart });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map