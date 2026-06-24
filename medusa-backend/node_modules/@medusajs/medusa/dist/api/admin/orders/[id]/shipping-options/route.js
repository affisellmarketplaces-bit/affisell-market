"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @since 2.10.0
 */
const GET = async (req, res) => {
    const { id } = req.params;
    const workflow = (0, core_flows_1.listShippingOptionsForOrderWorkflow)(req.scope);
    const { result: shipping_options } = await workflow.run({
        input: {
            order_id: id,
        },
    });
    res.json({ shipping_options });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map