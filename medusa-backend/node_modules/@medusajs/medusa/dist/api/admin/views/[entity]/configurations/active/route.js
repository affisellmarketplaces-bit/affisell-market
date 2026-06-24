"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const settingsService = req.scope.resolve(utils_1.Modules.SETTINGS);
    const viewConfiguration = await settingsService.getActiveViewConfiguration(req.params.entity, req.auth_context.actor_id);
    if (!viewConfiguration) {
        // No active view set or explicitly cleared - return null
        res.json({
            view_configuration: null,
            is_default_active: true,
            default_type: "code",
        });
    }
    else {
        res.json({
            view_configuration: viewConfiguration,
            is_default_active: viewConfiguration.is_system_default,
            default_type: viewConfiguration.is_system_default ? "system" : undefined,
        });
    }
};
exports.GET = GET;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const POST = async (req, res) => {
    const settingsService = req.scope.resolve(utils_1.Modules.SETTINGS);
    if (req.body.view_configuration_id === null) {
        // Clear the active view configuration
        await settingsService.clearActiveViewConfiguration(req.params.entity, req.auth_context.actor_id);
    }
    else {
        // Set a specific view as active
        await settingsService.setActiveViewConfiguration(req.params.entity, req.auth_context.actor_id, req.body.view_configuration_id);
    }
    res.json({ success: true });
};
exports.POST = POST;
//# sourceMappingURL=route.js.map