"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const http_1 = require("@medusajs/framework/http");
/**
 * @since 2.14.2
 */
const POST = async (req, res) => {
    const { id } = req.params;
    const { provider_id, data } = req.validatedBody;
    await (0, core_flows_1.createPaymentSessionsWorkflow)(req.scope).run({
        input: {
            payment_collection_id: id,
            provider_id,
            data,
        },
    });
    const paymentCollection = await (0, http_1.refetchEntity)({
        entity: "payment_collection",
        idOrFilter: id,
        scope: req.scope,
        fields: req.queryConfig.fields,
    });
    res.status(200).json({ payment_collection: paymentCollection });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map