"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [viewConfiguration], } = await query.graph({
        entity: "view_configuration",
        fields: req.queryConfig.fields,
        filters: { id: req.params.id },
    });
    if (!viewConfiguration) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `View configuration with id: ${req.params.id} not found`);
    }
    if (viewConfiguration.user_id &&
        viewConfiguration.user_id !== req.auth_context.actor_id &&
        !req.auth_context.app_metadata?.admin) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "You don't have access to this view configuration");
    }
    res.json({ view_configuration: viewConfiguration });
};
exports.GET = GET;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // Fetch existing for permission check
    const { data: [existing], } = await query.graph({
        entity: "view_configuration",
        fields: ["id", "user_id", "is_system_default"],
        filters: { id: req.params.id },
    });
    if (!existing) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `View configuration with id: ${req.params.id} not found`);
    }
    if (existing.user_id && existing.user_id !== req.auth_context.actor_id) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "You can only update your own view configurations");
    }
    const input = {
        id: req.params.id,
        ...req.validatedBody,
    };
    await (0, core_flows_1.updateViewConfigurationWorkflow)(req.scope).run({
        input,
    });
    const { data: [viewConfiguration], } = await query.graph({
        entity: "view_configuration",
        fields: req.queryConfig.fields,
        filters: { id: req.params.id },
    });
    res.json({ view_configuration: viewConfiguration });
};
exports.POST = POST;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const DELETE = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const settingsService = req.scope.resolve(utils_1.Modules.SETTINGS);
    // Fetch existing to check permissions
    const { data: [existing], } = await query.graph({
        entity: "view_configuration",
        fields: ["id", "user_id", "is_system_default", "entity", "name"],
        filters: { id: req.params.id },
    });
    if (!existing) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `View configuration with id: ${req.params.id} not found`);
    }
    if (existing.user_id && existing.user_id !== req.auth_context.actor_id) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "You can only delete your own view configurations");
    }
    await settingsService.deleteViewConfigurations(req.params.id);
    res.status(200).json({
        id: req.params.id,
        object: "view_configuration",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map