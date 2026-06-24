"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
/**
 * Batch create, update, and delete property labels.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { create, update, delete: toDelete } = req.validatedBody;
    const { result } = await (0, core_flows_1.batchPropertyLabelsWorkflow)(req.scope).run({
        input: {
            create: create?.map((item) => ({
                entity: item.entity,
                property: item.property,
                label: item.label,
                description: item.description ?? undefined,
            })),
            update: update?.map((item) => ({
                id: item.id,
                label: item.label,
                description: item.description ?? undefined,
            })),
            delete: toDelete,
        },
    });
    const createdIds = new Set(result.created.map((r) => r.id));
    const updatedIds = new Set(result.updated.map((r) => r.id));
    let createdLabels = [];
    let updatedLabels = [];
    const ids = Array.from(new Set([...createdIds, ...updatedIds]));
    const { data } = await query.graph({
        entity: "property_label",
        fields: req.queryConfig.fields,
        filters: { id: ids },
    });
    createdLabels = data.filter((l) => createdIds.has(l.id));
    updatedLabels = data.filter((l) => updatedIds.has(l.id));
    res.status(200).json({
        created: createdLabels,
        updated: updatedLabels,
        deleted: (result.deleted ?? []).map((id) => ({
            id,
            object: "property_label",
            deleted: true,
        })),
    });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map