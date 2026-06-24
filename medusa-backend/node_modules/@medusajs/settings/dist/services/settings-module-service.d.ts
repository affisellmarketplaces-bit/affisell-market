import { Context, DAL, HttpTypes, InferEntityType, InternalModuleDeclaration, ModulesSdkTypes, SettingsTypes } from "@medusajs/framework/types";
import { ViewConfiguration, PropertyLabel } from "../models";
import { EntityDiscoveryService } from "../utils";
type InjectedDependencies = {
    baseRepository: DAL.RepositoryService;
    viewConfigurationService: ModulesSdkTypes.IMedusaInternalService<any>;
    propertyLabelService: ModulesSdkTypes.IMedusaInternalService<any>;
};
declare const SettingsModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<{
    ViewConfiguration: {
        dto: SettingsTypes.ViewConfigurationDTO;
    };
    UserPreference: {
        dto: SettingsTypes.UserPreferenceDTO;
    };
    PropertyLabel: {
        dto: SettingsTypes.PropertyLabelDTO;
    };
}>;
export default class SettingsModuleService extends SettingsModuleService_base implements SettingsTypes.ISettingsModuleService {
    protected readonly moduleDeclaration: InternalModuleDeclaration;
    protected baseRepository_: DAL.RepositoryService;
    protected readonly viewConfigurationService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof ViewConfiguration>>;
    protected readonly propertyLabelService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof PropertyLabel>>;
    protected entityDiscoveryService_: EntityDiscoveryService;
    constructor({ baseRepository, viewConfigurationService, propertyLabelService, }: InjectedDependencies, moduleDeclaration: InternalModuleDeclaration);
    __hooks: {
        onApplicationStart: () => Promise<void>;
    };
    createViewConfigurations(data: SettingsTypes.CreateViewConfigurationDTO | SettingsTypes.CreateViewConfigurationDTO[], sharedContext?: Context): Promise<SettingsTypes.ViewConfigurationDTO | SettingsTypes.ViewConfigurationDTO[]>;
    updateViewConfigurations(idOrSelector: string | SettingsTypes.FilterableViewConfigurationProps, data: SettingsTypes.UpdateViewConfigurationDTO, sharedContext?: Context): Promise<SettingsTypes.ViewConfigurationDTO | SettingsTypes.ViewConfigurationDTO[]>;
    protected updateViewConfigurations_(idOrSelector: string | SettingsTypes.FilterableViewConfigurationProps, data: SettingsTypes.UpdateViewConfigurationDTO, sharedContext?: Context): Promise<InferEntityType<typeof ViewConfiguration>[]>;
    getUserPreference(userId: string, key: string, sharedContext?: Context): Promise<SettingsTypes.UserPreferenceDTO | null>;
    setUserPreference(userId: string, key: string, value: any, sharedContext?: Context): Promise<SettingsTypes.UserPreferenceDTO>;
    getActiveViewConfiguration(entity: string, userId: string, sharedContext?: Context): Promise<SettingsTypes.ViewConfigurationDTO | null>;
    setActiveViewConfiguration(entity: string, userId: string, viewConfigurationId: string, sharedContext?: Context): Promise<void>;
    getSystemDefaultViewConfiguration(entity: string, sharedContext?: Context): Promise<SettingsTypes.ViewConfigurationDTO | null>;
    clearActiveViewConfiguration(entity: string, userId: string, sharedContext?: Context): Promise<void>;
    upsertPropertyLabels(data: SettingsTypes.UpsertPropertyLabelDTO[], sharedContext?: Context): Promise<SettingsTypes.PropertyLabelDTO[]>;
    /**
     * Check if entity discovery has been initialized.
     */
    isEntityDiscoveryInitialized(): boolean;
    /**
     * List all discoverable entities.
     */
    listDiscoverableEntities(): HttpTypes.AdminEntityInfo[];
    /**
     * Check if an entity exists by name.
     */
    hasEntity(name: string): boolean;
    /**
     * Generate columns for an entity.
     */
    generateEntityColumns(entityKey: string, sharedContext?: Context): Promise<SettingsTypes.ViewConfigurationColumnDTO[] | null>;
}
export {};
//# sourceMappingURL=settings-module-service.d.ts.map