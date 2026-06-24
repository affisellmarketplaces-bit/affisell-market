"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @since 2.8.5
 */
const POST = async (req, res) => {
    const { result, transaction } = await (0, core_flows_1.importProductsAsChunksWorkflow)(req.scope).run({
        input: {
            filename: req.validatedBody.originalname,
            fileKey: req.validatedBody.file_key,
        },
    });
    res
        .status(202)
        .json({ transaction_id: transaction.transactionId, summary: result });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map