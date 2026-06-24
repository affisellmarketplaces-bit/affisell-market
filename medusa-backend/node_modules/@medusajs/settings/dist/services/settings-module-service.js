"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@medusajs/framework/types");
const utils_1 = require("@medusajs/framework/utils");
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const models_1 = require("../models");
const utils_2 = require("../utils");
class SettingsModuleService extends (0, utils_1.MedusaService)({ ViewConfiguration: models_1.ViewConfiguration, UserPreference: models_1.UserPreference, PropertyLabel: models_1.PropertyLabel }) {
    constructor({ baseRepository, viewConfigurationService, propertyLabelService, }, moduleDeclaration) {
        super(...arguments);
        this.moduleDeclaration = moduleDeclaration;
        this.__hooks = {
            onApplicationStart: async () => {
                // Initialize entity discovery with joiner configs
                const joinerConfigs = modules_sdk_1.MedusaModule.getAllJoinerConfigs();
                this.entityDiscoveryService_.initialize(joinerConfigs);
            },
        };
        this.baseRepository_ = baseRepository;
        this.viewConfigurationService_ = viewConfigurationService;
        this.propertyLabelService_ = propertyLabelService;
        this.entityDiscoveryService_ = new utils_2.EntityDiscoveryService();
    }
    // @ts-expect-error
    async createViewConfigurations(data, sharedContext = {}) {
        // Convert to array for validation only
        const isArrayInput = Array.isArray(data);
        const dataArray = isArrayInput ? data : [data];
        // Validate system defaults
        for (const config of dataArray) {
            if (config.is_system_default && config.user_id) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "System default view configurations cannot have a user_id");
            }
            if (config.is_system_default) {
                // Check if a system default already exists for this entity
                const existingDefault = await this.viewConfigurationService_.list({
                    entity: config.entity,
                    is_system_default: true,
                }, { select: ["id"] }, sharedContext);
                if (existingDefault.length > 0) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.DUPLICATE_ERROR, `A system default view configuration already exists for entity: ${config.entity}`);
                }
            }
        }
        const result = await super.createViewConfigurations(dataArray, sharedContext);
        return await this.baseRepository_.serialize(isArrayInput ? result : result[0]);
    }
    // @ts-expect-error
    async updateViewConfigurations(idOrSelector, data, sharedContext = {}) {
        const updated = await this.updateViewConfigurations_(idOrSelector, data, sharedContext);
        const serialized = await this.baseRepository_.serialize(updated);
        return typeof idOrSelector === "string" ? serialized[0] : serialized;
    }
    async updateViewConfigurations_(idOrSelector, data, sharedContext = {}) {
        let selector = {};
        if (typeof idOrSelector === "string") {
            selector = { id: idOrSelector };
        }
        else {
            selector = idOrSelector;
        }
        // Special handling for configuration updates to ensure replacement instead of merge
        if (data.configuration) {
            // First, get the entities to update
            const entities = await this.viewConfigurationService_.list(selector, {}, sharedContext);
            if (entities.length === 0) {
                return typeof idOrSelector === "string" ? [] : [];
            }
            // Use upsertWithReplace to update the configuration field without merging
            const updateDataArray = entities.map((entity) => ({
                id: entity.id,
                ...data,
                configuration: {
                    visible_columns: data.configuration?.visible_columns ?? [],
                    column_order: data.configuration?.column_order ?? [],
                    column_widths: data.configuration?.column_widths !== undefined
                        ? data.configuration.column_widths
                        : {},
                    filters: data.configuration?.filters !== undefined
                        ? data.configuration.filters
                        : {},
                    sorting: data.configuration?.sorting !== undefined
                        ? data.configuration.sorting
                        : null,
                    search: data.configuration?.search !== undefined
                        ? data.configuration.search
                        : "",
                },
            }));
            // Use upsertWithReplace which uses nativeUpdateMany internally and doesn't merge JSON fields
            const { entities: updatedEntities } = await this.viewConfigurationService_.upsertWithReplace(updateDataArray, { relations: [] }, sharedContext);
            return updatedEntities;
        }
        // For non-configuration updates, use the standard update method
        const updated = await this.viewConfigurationService_.update({ selector, data }, sharedContext);
        return updated;
    }
    async getUserPreference(userId, key, sharedContext = {}) {
        const prefs = await this.listUserPreferences({ user_id: userId, key }, { take: 1 }, sharedContext);
        return prefs.length > 0 ? prefs[0] : null;
    }
    async setUserPreference(userId, key, value, sharedContext = {}) {
        const existing = await this.listUserPreferences({ user_id: userId, key }, { take: 1, select: ["id"] }, sharedContext);
        if (existing.length > 0) {
            const [updated] = await this.updateUserPreferences([{ id: existing[0].id, value }], sharedContext);
            return updated;
        }
        else {
            const created = await this.createUserPreferences({ user_id: userId, key, value }, sharedContext);
            return Array.isArray(created) ? created[0] : created;
        }
    }
    async getActiveViewConfiguration(entity, userId, sharedContext = {}) {
        // Check if user has an active view preference
        const activeViewPref = await this.getUserPreference(userId, `active_view.${entity}`, sharedContext);
        // Check if we have a preference with a view configuration ID (not explicitly null)
        if (activeViewPref &&
            activeViewPref.value?.viewConfigurationId &&
            activeViewPref.value.viewConfigurationId !== null) {
            try {
                return await this.retrieveViewConfiguration(activeViewPref.value.viewConfigurationId, {}, sharedContext);
            }
            catch (error) {
                // View configuration might have been deleted
            }
        }
        // If we have an explicit null preference, or no preference, or a deleted view
        // We should check for defaults in this order:
        // Check if user has any personal views (only if no explicit null preference)
        if (!activeViewPref || activeViewPref.value?.viewConfigurationId !== null) {
            const [personalView] = await this.listViewConfigurations({ entity, user_id: userId }, { take: 1, order: { created_at: "ASC" } }, sharedContext);
            if (personalView) {
                return personalView;
            }
        }
        // Fall back to system default
        const systemDefaults = await this.listViewConfigurations({ entity, is_system_default: true }, {}, sharedContext);
        return systemDefaults.length > 0 ? systemDefaults[0] : null;
    }
    async setActiveViewConfiguration(entity, userId, viewConfigurationId, sharedContext = {}) {
        // Verify the view configuration exists and user has access
        const viewConfig = await this.retrieveViewConfiguration(viewConfigurationId, {}, sharedContext);
        if (viewConfig.entity !== entity) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `View configuration ${viewConfigurationId} is not for entity ${entity}`);
        }
        if (viewConfig.user_id && viewConfig.user_id !== userId) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, `User ${userId} does not have access to view configuration ${viewConfigurationId}`);
        }
        await this.setUserPreference(userId, `active_view.${entity}`, { viewConfigurationId }, sharedContext);
    }
    async getSystemDefaultViewConfiguration(entity, sharedContext = {}) {
        const systemDefaults = await this.listViewConfigurations({ entity, is_system_default: true }, {}, sharedContext);
        return systemDefaults.length > 0 ? systemDefaults[0] : null;
    }
    async clearActiveViewConfiguration(entity, userId, sharedContext = {}) {
        await this.setUserPreference(userId, `active_view.${entity}`, { viewConfigurationId: null }, sharedContext);
    }
    async upsertPropertyLabels(data, sharedContext = {}) {
        const upserted = await this.propertyLabelService_.upsert(data, sharedContext);
        return await this.baseRepository_.serialize(upserted);
    }
    /**
     * Check if entity discovery has been initialized.
     */
    isEntityDiscoveryInitialized() {
        return this.entityDiscoveryService_.isInitialized();
    }
    /**
     * List all discoverable entities.
     */
    listDiscoverableEntities() {
        if (!this.entityDiscoveryService_.isInitialized()) {
            return [];
        }
        const entities = this.entityDiscoveryService_.discoverEntities();
        return entities.map((entity) => this.entityDiscoveryService_.getEntityInfo(entity, (0, utils_2.hasEntityOverride)(entity.name)));
    }
    /**
     * Check if an entity exists by name.
     */
    hasEntity(name) {
        return this.entityDiscoveryService_.hasEntity(name);
    }
    /**
     * Generate columns for an entity.
     */
    async generateEntityColumns(entityKey, sharedContext = {}) {
        if (!this.entityDiscoveryService_.isInitialized()) {
            return null;
        }
        const entity = this.entityDiscoveryService_.getEntity(entityKey);
        if (!entity) {
            return null;
        }
        const labels = await this.propertyLabelService_.list({ entity: entity.name }, {}, sharedContext);
        const propertyLabelsMap = new Map();
        for (const label of labels) {
            propertyLabelsMap.set(label.property, {
                id: label.id,
                entity: label.entity,
                property: label.property,
                label: label.label,
                description: label.description,
            });
        }
        const columns = (0, utils_2.generateEntityColumns)(this.entityDiscoveryService_, entityKey, propertyLabelsMap);
        return await this.baseRepository_.serialize(columns);
    }
}
exports.default = SettingsModuleService;
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "createViewConfigurations", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "updateViewConfigurations", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "updateViewConfigurations_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "getUserPreference", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(3, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "setUserPreference", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "getActiveViewConfiguration", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(3, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "setActiveViewConfiguration", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "getSystemDefaultViewConfiguration", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "clearActiveViewConfiguration", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "upsertPropertyLabels", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SettingsModuleService.prototype, "generateEntityColumns", null);
//# sourceMappingURL=settings-module-service.js.map