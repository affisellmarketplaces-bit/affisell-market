"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const filters = {
        ...req.filterableFields,
        entity: req.params.entity,
        $or: [{ user_id: req.auth_context.actor_id }, { is_system_default: true }],
    };
    const { data: viewConfigurations, metadata } = await query.graph({
        entity: "view_configuration",
        fields: req.queryConfig.fields,
        filters,
        pagination: req.queryConfig.pagination,
    });
    res.json({
        view_configurations: viewConfigurations,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 20,
    });
};
exports.GET = GET;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // Validate: name is required unless creating a system default
    if (!req.body.is_system_default && !req.body.name) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Name is required unless creating a system default view");
    }
    const input = {
        ...req.body,
        entity: req.params.entity,
        user_id: req.body.is_system_default ? null : req.auth_context.actor_id,
    };
    const { result } = await (0, core_flows_1.createViewConfigurationWorkflow)(req.scope).run({
        input,
    });
    const { data: [viewConfiguration], } = await query.graph({
        entity: "view_configuration",
        fields: req.queryConfig.fields,
        filters: { id: result.id },
    });
    return res.json({ view_configuration: viewConfiguration });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map