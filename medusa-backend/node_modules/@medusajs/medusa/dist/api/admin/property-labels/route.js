"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
/**
 * List property labels.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: labels, metadata } = await query.graph({
        entity: "property_label",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
    });
    res.json({
        property_labels: labels,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 0,
    });
};
exports.GET = GET;
/**
 * Create a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { entity, property, label, description } = req.validatedBody;
    const { result } = await (0, core_flows_1.createPropertyLabelsWorkflow)(req.scope).run({
        input: {
            property_labels: [
                {
                    entity,
                    property,
                    label,
                    description: description ?? undefined,
                },
            ],
        },
    });
    const { data: [propertyLabel], } = await query.graph({
        entity: "property_label",
        fields: req.queryConfig.fields,
        filters: { id: result[0].id },
    });
    res.status(201).json({ property_label: propertyLabel });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map