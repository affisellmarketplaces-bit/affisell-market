"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @since 2.11.2
 */
const POST = async (req, res) => {
    const variantId = req.params.variant_id;
    const { result } = await (0, core_flows_1.batchVariantImagesWorkflow)(req.scope).run({
        input: {
            variant_id: variantId,
            add: req.validatedBody.add,
            remove: req.validatedBody.remove,
        },
    });
    res.status(200).json({
        added: result.added,
        removed: result.removed,
    });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map