import { Context, CreateTranslationDTO, CreateTranslationSettingsDTO, DAL, FilterableTranslationProps, FindConfig, ITranslationModuleService, ModulesSdkTypes, TranslationTypes, UpdateTranslationSettingsDTO } from "@medusajs/framework/types";
import Locale from "../models/locale";
import Translation from "../models/translation";
import Settings from "../models/settings";
type InjectedDependencies = {
    baseRepository: DAL.RepositoryService;
    translationService: ModulesSdkTypes.IMedusaInternalService<typeof Translation>;
    localeService: ModulesSdkTypes.IMedusaInternalService<typeof Locale>;
    translationSettingsService: ModulesSdkTypes.IMedusaInternalService<typeof Settings>;
};
declare const TranslationModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<{
    Locale: {
        dto: TranslationTypes.LocaleDTO;
    };
    Translation: {
        dto: TranslationTypes.TranslationDTO;
    };
    TranslationSettings: {
        dto: TranslationTypes.TranslationSettingsDTO;
    };
}>;
export default class TranslationModuleService extends TranslationModuleService_base implements ITranslationModuleService {
    protected baseRepository_: DAL.RepositoryService;
    protected translationService_: ModulesSdkTypes.IMedusaInternalService<typeof Translation>;
    protected localeService_: ModulesSdkTypes.IMedusaInternalService<typeof Locale>;
    protected settingsService_: ModulesSdkTypes.IMedusaInternalService<typeof Settings>;
    constructor({ baseRepository, translationService, localeService, translationSettingsService, }: InjectedDependencies);
    __hooks: {
        onApplicationStart: () => Promise<void>;
    };
    protected onApplicationStart_(): Promise<void>;
    getTranslatableFields(entityType?: string, sharedContext?: Context): Promise<Record<string, string[]>>;
    getInactiveTranslatableFields(entityType?: string, sharedContext?: Context): Promise<Record<string, string[]>>;
    static prepareFilters(filters: FilterableTranslationProps): FilterableTranslationProps;
    retrieveTranslation(id: string, config?: FindConfig<TranslationTypes.TranslationDTO>, sharedContext?: Context): Promise<TranslationTypes.TranslationDTO>;
    /**
     * Ensures the 'reference' field is included in the select config.
     * This is needed for filtering translations by translatable fields.
     */
    static ensureReferenceFieldInConfig(config: FindConfig<TranslationTypes.TranslationDTO>): FindConfig<TranslationTypes.TranslationDTO>;
    listTranslations(filters?: FilterableTranslationProps, config?: FindConfig<TranslationTypes.TranslationDTO>, sharedContext?: Context): Promise<TranslationTypes.TranslationDTO[]>;
    listAndCountTranslations(filters?: FilterableTranslationProps, config?: FindConfig<TranslationTypes.TranslationDTO>, sharedContext?: Context): Promise<[TranslationTypes.TranslationDTO[], number]>;
    createLocales(data: TranslationTypes.CreateLocaleDTO[], sharedContext?: Context): Promise<TranslationTypes.LocaleDTO[]>;
    createLocales(data: TranslationTypes.CreateLocaleDTO, sharedContext?: Context): Promise<TranslationTypes.LocaleDTO>;
    createTranslations(data: CreateTranslationDTO, sharedContext?: Context): Promise<TranslationTypes.TranslationDTO>;
    createTranslations(data: CreateTranslationDTO[], sharedContext?: Context): Promise<TranslationTypes.TranslationDTO[]>;
    updateTranslations(data: TranslationTypes.UpdateTranslationDTO, sharedContext?: Context): Promise<TranslationTypes.TranslationDTO>;
    updateTranslations(data: TranslationTypes.UpdateTranslationDTO[], sharedContext?: Context): Promise<TranslationTypes.TranslationDTO[]>;
    createTranslationSettings(data: CreateTranslationSettingsDTO[] | CreateTranslationSettingsDTO, sharedContext?: Context): Promise<TranslationTypes.TranslationSettingsDTO | TranslationTypes.TranslationSettingsDTO[]>;
    updateTranslationSettings(data: UpdateTranslationSettingsDTO | UpdateTranslationSettingsDTO[], sharedContext?: Context): Promise<TranslationTypes.TranslationSettingsDTO[] | TranslationTypes.TranslationSettingsDTO>;
    getStatistics(input: TranslationTypes.TranslationStatisticsInput, sharedContext?: Context): Promise<TranslationTypes.TranslationStatisticsOutput>;
    /**
     * Validates the translation settings to create or update against the translatable entities and their translatable fields configuration.
     * @param dataToValidate - The data to validate.
     */
    static validateSettings(dataToValidate: (CreateTranslationSettingsDTO | (UpdateTranslationSettingsDTO & {
        entity_type: string;
    }))[]): void;
    /**
     * Ensures the entity type is set for the settings to be created or updated. This is useful for validation purposes and recomputing the translated field count.
     * @param settings - The settings to ensure the entity type for.
     * @param sharedContext - A context used to share resources, such as transaction manager, between the application and the module.
     * @returns The settings with the entity type set.
     */
    protected ensureEntityType_(settings: (CreateTranslationSettingsDTO | UpdateTranslationSettingsDTO)[], sharedContext?: Context): Promise<(CreateTranslationSettingsDTO | (UpdateTranslationSettingsDTO & {
        entity_type: string;
    }))[]>;
}
export {};
//# sourceMappingURL=translation-module.d.ts.map