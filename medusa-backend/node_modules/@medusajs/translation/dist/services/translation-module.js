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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@medusajs/framework/mikro-orm/core");
const types_1 = require("@medusajs/framework/types");
const utils_1 = require("@medusajs/framework/utils");
const locale_1 = __importDefault(require("../models/locale"));
const translation_1 = __importDefault(require("../models/translation"));
const settings_1 = __importDefault(require("../models/settings"));
const compute_translated_field_count_1 = require("../utils/compute-translated-field-count");
const filter_translation_fields_1 = require("../utils/filter-translation-fields");
class TranslationModuleService extends (0, utils_1.MedusaService)({
    Locale: locale_1.default,
    Translation: translation_1.default,
    TranslationSettings: settings_1.default,
}) {
    constructor({ baseRepository, translationService, localeService, translationSettingsService, }) {
        super(...arguments);
        this.__hooks = {
            onApplicationStart: async () => {
                return this.onApplicationStart_();
            },
        };
        this.baseRepository_ = baseRepository;
        this.translationService_ = translationService;
        this.localeService_ = localeService;
        this.settingsService_ = translationSettingsService;
    }
    async onApplicationStart_() {
        const translatableEntities = utils_1.DmlEntity.getTranslatableEntities();
        const translatableEntitiesSet = new Set(translatableEntities.map((entity) => (0, utils_1.toSnakeCase)(entity.entity)));
        const currentTranslationSettings = await this.settingsService_.list();
        const currentTranslationSettingsSet = new Set(currentTranslationSettings.map((setting) => setting.entity_type));
        const settingsToUpsert = [];
        for (const setting of currentTranslationSettings) {
            if (!translatableEntitiesSet.has(setting.entity_type) &&
                setting.is_active) {
                settingsToUpsert.push({
                    id: setting.id,
                    is_active: false,
                });
            }
        }
        for (const entity of translatableEntities) {
            const snakeCaseEntityType = (0, utils_1.toSnakeCase)(entity.entity);
            const hasCurrentSettings = currentTranslationSettingsSet.has(snakeCaseEntityType);
            if (!hasCurrentSettings) {
                settingsToUpsert.push({
                    entity_type: snakeCaseEntityType,
                    fields: entity.fields,
                });
            }
        }
        await this.settingsService_.upsert(settingsToUpsert);
    }
    async getTranslatableFields(entityType, sharedContext = {}) {
        const filters = entityType ? { entity_type: entityType } : {};
        const settings = await this.settingsService_.list(filters, {}, sharedContext);
        return settings.reduce((acc, setting) => {
            acc[setting.entity_type] = setting.is_active
                ? setting.fields
                : [];
            return acc;
        }, {});
    }
    async getInactiveTranslatableFields(entityType, sharedContext = {}) {
        const translatableFields = await this.getTranslatableFields(entityType, sharedContext);
        return Object.entries(translatableFields).reduce((acc, [entityType, fields]) => {
            const entity = utils_1.DmlEntity.getTranslatableEntities().find((entity) => (0, utils_1.toSnakeCase)(entity.entity) === entityType);
            if (!entity) {
                return acc;
            }
            acc[entityType] = (0, utils_1.arrayDifference)(entity.fields, fields);
            return acc;
        }, {});
    }
    static prepareFilters(filters) {
        let { q, ...restFilters } = filters;
        if (q) {
            restFilters = {
                ...restFilters,
                [(0, core_1.raw)(`translations::text ILIKE ?`, [`%${q}%`])]: [],
            };
        }
        return restFilters;
    }
    // @ts-expect-error
    async retrieveTranslation(id, config = {}, sharedContext = {}) {
        const configWithReference = TranslationModuleService.ensureReferenceFieldInConfig(config);
        const result = await this.translationService_.retrieve(id, configWithReference, sharedContext);
        const serialized = await this.baseRepository_.serialize(result);
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        return (0, filter_translation_fields_1.filterTranslationFields)([serialized], translatableFieldsConfig)[0];
    }
    /**
     * Ensures the 'reference' field is included in the select config.
     * This is needed for filtering translations by translatable fields.
     */
    static ensureReferenceFieldInConfig(config) {
        if (!config?.select?.length) {
            return config;
        }
        const select = config.select;
        if (!select.includes("reference")) {
            return { ...config, select: [...select, "reference"] };
        }
        return config;
    }
    // @ts-expect-error
    async listTranslations(filters = {}, config = {}, sharedContext = {}) {
        const preparedFilters = TranslationModuleService.prepareFilters(filters);
        const configWithReference = TranslationModuleService.ensureReferenceFieldInConfig(config);
        const results = await this.translationService_.list(preparedFilters, configWithReference, sharedContext);
        const serialized = await this.baseRepository_.serialize(results);
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        return (0, filter_translation_fields_1.filterTranslationFields)(serialized, translatableFieldsConfig);
    }
    // @ts-expect-error
    async listAndCountTranslations(filters = {}, config = {}, sharedContext = {}) {
        const preparedFilters = TranslationModuleService.prepareFilters(filters);
        const configWithReference = TranslationModuleService.ensureReferenceFieldInConfig(config);
        const [results, count] = await this.translationService_.listAndCount(preparedFilters, configWithReference, sharedContext);
        const serialized = await this.baseRepository_.serialize(results);
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        return [
            (0, filter_translation_fields_1.filterTranslationFields)(serialized, translatableFieldsConfig),
            count,
        ];
    }
    // @ts-expect-error
    async createLocales(data, sharedContext = {}) {
        const dataArray = Array.isArray(data) ? data : [data];
        const normalizedData = dataArray.map((locale) => ({
            ...locale,
            code: (0, utils_1.normalizeLocale)(locale.code),
        }));
        const createdLocales = await this.localeService_.create(normalizedData, sharedContext);
        const serialized = await this.baseRepository_.serialize(createdLocales);
        return Array.isArray(data) ? serialized : serialized[0];
    }
    // @ts-expect-error
    async createTranslations(data, sharedContext = {}) {
        const dataArray = Array.isArray(data) ? data : [data];
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        const normalizedData = dataArray.map((translation) => ({
            ...translation,
            locale_code: (0, utils_1.normalizeLocale)(translation.locale_code),
            translated_field_count: (0, compute_translated_field_count_1.computeTranslatedFieldCount)(translation.translations, translatableFieldsConfig[translation.reference]),
        }));
        const createdTranslations = await this.translationService_.create(normalizedData, sharedContext);
        const serialized = await this.baseRepository_.serialize(createdTranslations);
        return Array.isArray(data) ? serialized : serialized[0];
    }
    // @ts-expect-error
    async updateTranslations(data, sharedContext = {}) {
        const dataArray = Array.isArray(data) ? data : [data];
        const updatesWithTranslations = dataArray.filter((d) => d.translations);
        if (updatesWithTranslations.length) {
            const idsNeedingReference = updatesWithTranslations
                .filter((d) => !d.reference)
                .map((d) => d.id);
            let referenceMap = {};
            if (idsNeedingReference.length) {
                const existingTranslations = await this.translationService_.list({ id: idsNeedingReference }, { select: ["id", "reference"] }, sharedContext);
                referenceMap = Object.fromEntries(existingTranslations.map((t) => [t.id, t.reference]));
            }
            const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
            for (const update of dataArray) {
                if (update.translations) {
                    const reference = update.reference || referenceMap[update.id];
                    update.translated_field_count = (0, compute_translated_field_count_1.computeTranslatedFieldCount)(update.translations, translatableFieldsConfig[reference] || []);
                }
            }
        }
        const updatedTranslations = await this.translationService_.update(dataArray, sharedContext);
        const serialized = await this.baseRepository_.serialize(updatedTranslations);
        return Array.isArray(data) ? serialized : serialized[0];
    }
    // @ts-expect-error
    async createTranslationSettings(data, sharedContext = {}) {
        const dataArray = Array.isArray(data) ? data : [data];
        const normalizedData = await this.ensureEntityType_(dataArray, sharedContext);
        TranslationModuleService.validateSettings(normalizedData);
        // @ts-expect-error TS can't match union type to overloads
        return await super.createTranslationSettings(data, sharedContext);
    }
    // @ts-expect-error
    async updateTranslationSettings(data, sharedContext = {}) {
        const dataArray = Array.isArray(data) ? data : [data];
        const normalizedData = await this.ensureEntityType_(dataArray, sharedContext);
        TranslationModuleService.validateSettings(normalizedData);
        const updatedSettings = await this.settingsService_.update(data, sharedContext);
        const entityTypes = [
            ...new Set(normalizedData.map((setting) => setting.entity_type)),
        ];
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        const translations = await this.translationService_.list({
            reference: entityTypes,
        });
        const toUpdate = translations.map((translation) => ({
            id: translation.id,
            translated_field_count: (0, compute_translated_field_count_1.computeTranslatedFieldCount)(translation.translations, translatableFieldsConfig[translation.reference] ?? []),
        }));
        if (toUpdate.length) {
            await this.translationService_.update(toUpdate, sharedContext);
        }
        const serialized = await this.baseRepository_.serialize(updatedSettings);
        return Array.isArray(data) ? serialized : serialized[0];
    }
    async getStatistics(input, sharedContext = {}) {
        const { locales, entities } = input;
        if (!locales || !locales.length) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "At least one locale must be provided");
        }
        if (!entities || !Object.keys(entities).length) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "At least one entity type must be provided");
        }
        const normalizedLocales = locales.map(utils_1.normalizeLocale);
        const manager = (sharedContext.transactionManager ??
            sharedContext.manager);
        const knex = manager.getKnex();
        const translatableFieldsConfig = await this.getTranslatableFields(undefined, sharedContext);
        const result = {};
        const entityTypes = [];
        for (const entityType of Object.keys(entities)) {
            const translatableFields = translatableFieldsConfig[entityType];
            if (!translatableFields || translatableFields.length === 0) {
                result[entityType] = {
                    expected: 0,
                    translated: 0,
                    missing: 0,
                    by_locale: Object.fromEntries(normalizedLocales.map((locale) => [
                        locale,
                        { expected: 0, translated: 0, missing: 0 },
                    ])),
                };
            }
            else {
                entityTypes.push(entityType);
            }
        }
        if (!entityTypes.length) {
            return result;
        }
        const { rows } = await knex.raw(`
      SELECT
        reference,
        locale_code,
        COALESCE(SUM(translated_field_count), 0)::int AS translated_field_count
      FROM translation
      WHERE reference = ANY(?)
        AND locale_code = ANY(?)
        AND deleted_at IS NULL
      GROUP BY reference, locale_code
      `, [entityTypes, normalizedLocales]);
        for (const entityType of entityTypes) {
            const translatableFields = translatableFieldsConfig[entityType];
            const fieldsPerEntity = translatableFields.length;
            const entityCount = entities[entityType].count;
            const expectedPerLocale = entityCount * fieldsPerEntity;
            result[entityType] = {
                expected: expectedPerLocale * normalizedLocales.length,
                translated: 0,
                missing: expectedPerLocale * normalizedLocales.length,
                by_locale: Object.fromEntries(normalizedLocales.map((locale) => [
                    locale,
                    {
                        expected: expectedPerLocale,
                        translated: 0,
                        missing: expectedPerLocale,
                    },
                ])),
            };
        }
        for (const row of rows) {
            const entityType = row.reference;
            const localeCode = row.locale_code;
            const translatedCount = parseInt(row.translated_field_count, 10) || 0;
            result[entityType].by_locale[localeCode].translated = translatedCount;
            result[entityType].by_locale[localeCode].missing =
                result[entityType].by_locale[localeCode].expected - translatedCount;
            result[entityType].translated += translatedCount;
        }
        for (const entityType of entityTypes) {
            result[entityType].missing =
                result[entityType].expected - result[entityType].translated;
        }
        return result;
    }
    /**
     * Validates the translation settings to create or update against the translatable entities and their translatable fields configuration.
     * @param dataToValidate - The data to validate.
     */
    static validateSettings(dataToValidate) {
        const translatableEntities = utils_1.DmlEntity.getTranslatableEntities();
        const translatableEntitiesMap = new Map(translatableEntities.map((entity) => [(0, utils_1.toSnakeCase)(entity.entity), entity]));
        const invalidSettings = [];
        for (const item of dataToValidate) {
            const entityType = item.entity_type;
            const entity = translatableEntitiesMap.get(entityType);
            if (!entity) {
                invalidSettings.push({
                    entity_type: entityType,
                    is_invalid_entity: true,
                });
            }
            else {
                const invalidFields = (0, utils_1.arrayDifference)(item.fields ?? [], entity.fields);
                if (invalidFields.length) {
                    invalidSettings.push({
                        entity_type: entityType,
                        is_invalid_entity: false,
                        invalidFields,
                    });
                }
            }
        }
        if (invalidSettings.length) {
            throw new utils_1.MedusaError(utils_1.MedusaErrorTypes.INVALID_DATA, "Invalid translation settings:\n" +
                invalidSettings
                    .map((setting) => `- ${setting.entity_type} ${setting.is_invalid_entity
                    ? "is not a translatable entity"
                    : `doesn't have the following fields set as translatable: ${setting.invalidFields?.join(", ")}`}`)
                    .join("\n"));
        }
    }
    /**
     * Ensures the entity type is set for the settings to be created or updated. This is useful for validation purposes and recomputing the translated field count.
     * @param settings - The settings to ensure the entity type for.
     * @param sharedContext - A context used to share resources, such as transaction manager, between the application and the module.
     * @returns The settings with the entity type set.
     */
    async ensureEntityType_(settings, sharedContext = {}) {
        const idsNeedingResolution = settings
            .filter((setting) => !setting.entity_type && "id" in setting)
            .map((setting) => setting.id);
        let entityTypeMap = {};
        if (idsNeedingResolution.length) {
            const existingSettings = await this.settingsService_.list({ id: idsNeedingResolution }, { select: ["id", "entity_type"] }, sharedContext);
            entityTypeMap = Object.fromEntries(existingSettings.map((s) => [s.id, s.entity_type]));
        }
        return settings.map((setting) => {
            const entityType = setting.entity_type ||
                entityTypeMap[setting.id];
            return { ...setting, entity_type: entityType };
        });
    }
}
exports.default = TranslationModuleService;
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "getTranslatableFields", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "getInactiveTranslatableFields", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "retrieveTranslation", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "listTranslations", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "listAndCountTranslations", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "createLocales", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "createTranslations", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "updateTranslations", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "createTranslationSettings", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "updateTranslationSettings", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "getStatistics", null);
__decorate([
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], TranslationModuleService.prototype, "ensureEntityType_", null);
//# sourceMappingURL=translation-module.js.map