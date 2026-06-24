"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
/**
 * Get a property label by ID.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { id } = req.params;
    const { data: [propertyLabel], } = await query.graph({
        entity: "property_label",
        fields: req.queryConfig.fields,
        filters: { id },
    });
    if (!propertyLabel) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Property label with id: ${id} not found`);
    }
    res.json({ property_label: propertyLabel });
};
exports.GET = GET;
/**
 * Update a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { id } = req.params;
    const { label, description } = req.validatedBody;
    await (0, core_flows_1.updatePropertyLabelsWorkflow)(req.scope).run({
        input: {
            property_labels: [
                {
                    id,
                    label,
                    description: description ?? undefined,
                },
            ],
        },
    });
    const { data: [propertyLabel], } = await query.graph({
        entity: "property_label",
        fields: req.queryConfig.fields,
        filters: { id },
    });
    res.json({ property_label: propertyLabel });
};
exports.POST = POST;
/**
 * Delete a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const DELETE = async (req, res) => {
    const { id } = req.params;
    await (0, core_flows_1.deletePropertyLabelsWorkflow)(req.scope).run({
        input: { ids: [id] },
    });
    res.status(200).json({
        id,
        object: "property_label",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map