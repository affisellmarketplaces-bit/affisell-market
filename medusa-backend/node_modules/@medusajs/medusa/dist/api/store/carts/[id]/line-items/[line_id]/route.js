"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const helpers_1 = require("../../../helpers");
const POST = async (req, res) => {
    const we = req.scope.resolve(utils_1.Modules.WORKFLOW_ENGINE);
    await we.run(core_flows_1.updateLineItemInCartWorkflowId, {
        input: {
            cart_id: req.params.id,
            item_id: req.params.line_id,
            update: req.validatedBody,
            additional_data: req.validatedBody.additional_data,
        },
    });
    const updatedCart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({ cart: updatedCart });
};
exports.POST = POST;
const DELETE = async (req, res) => {
    const id = req.params.line_id;
    const we = req.scope.resolve(utils_1.Modules.WORKFLOW_ENGINE);
    await we.run(core_flows_1.deleteLineItemsWorkflowId, {
        input: {
            cart_id: req.params.id,
            ids: [id],
        },
    });
    const cart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({
        id: id,
        object: "line-item",
        deleted: true,
        parent: cart,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map