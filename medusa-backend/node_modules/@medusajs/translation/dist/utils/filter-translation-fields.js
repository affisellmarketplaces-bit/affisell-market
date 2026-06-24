"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterTranslationFields = filterTranslationFields;
function filterTranslationFields(translations, translatableFieldsConfig) {
    return translations.map((translation) => {
        const allowedFields = translatableFieldsConfig[translation.reference];
        if (!allowedFields?.length) {
            translation.translations = {};
            return translation;
        }
        const filteredTranslations = {};
        for (const field of allowedFields) {
            if (translation.translations &&
                field in translation.translations) {
                filteredTranslations[field] = translation.translations[field];
            }
        }
        translation.translations = filteredTranslations;
        return translation;
    });
}
//# sourceMappingURL=filter-translation-fields.js.map