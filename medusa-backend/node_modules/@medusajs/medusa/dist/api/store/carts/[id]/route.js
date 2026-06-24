"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const helpers_1 = require("../helpers");
const GET = async (req, res) => {
    const cart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.json({ cart });
};
exports.GET = GET;
const POST = async (req, res) => {
    const we = req.scope.resolve(utils_1.Modules.WORKFLOW_ENGINE);
    await we.run(core_flows_1.updateCartWorkflowId, {
        input: {
            ...req.validatedBody,
            id: req.params.id,
            additional_data: req.validatedBody.additional_data,
        },
    });
    const cart = await (0, helpers_1.refetchCart)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({ cart });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map