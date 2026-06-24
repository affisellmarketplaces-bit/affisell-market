"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const helpers_1 = require("../helpers");
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.10.0
 */
const GET = async (req, res) => {
    const shippingOptionType = await (0, helpers_1.refetchShippingOptionType)(req.params.id, req.scope, req.queryConfig.fields);
    res.status(200).json({ shipping_option_type: shippingOptionType });
};
exports.GET = GET;
/**
 * @since 2.10.0
 */
const POST = async (req, res) => {
    const existingShippingOptionType = await (0, helpers_1.refetchShippingOptionType)(req.params.id, req.scope, ["id"]);
    if (!existingShippingOptionType) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Shipping option type with id "${req.params.id}" not found`);
    }
    const { result } = await (0, core_flows_1.updateShippingOptionTypesWorkflow)(req.scope).run({
        input: {
            selector: { id: req.params.id },
            update: req.validatedBody,
        },
    });
    const shippingOptionType = await (0, helpers_1.refetchShippingOptionType)(result[0].id, req.scope, req.queryConfig.fields);
    res.status(200).json({ shipping_option_type: shippingOptionType });
};
exports.POST = POST;
/**
 * @since 2.10.0
 */
const DELETE = async (req, res) => {
    const id = req.params.id;
    await (0, core_flows_1.deleteShippingOptionTypesWorkflow)(req.scope).run({
        input: { ids: [id] },
    });
    res.status(200).json({
        id,
        object: "shipping_option_type",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map