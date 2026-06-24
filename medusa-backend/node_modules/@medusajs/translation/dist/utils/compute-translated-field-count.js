"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTranslatedFieldCount = computeTranslatedFieldCount;
/**
 * Computes the count of translated fields based on the translatable fields configuration.
 * Only counts fields that are:
 * 1. In the translatableFields array for the entity type
 * 2. Have a non-null, non-empty value in the translations object
 *
 * @param translations - The translations JSON object from the translation record
 * @param translatableFields - Array of field names that are translatable for this entity type
 * @returns The count of translated fields
 */
function computeTranslatedFieldCount(translations, translatableFields) {
    if (!translations || !translatableFields?.length) {
        return 0;
    }
    return translatableFields.filter((field) => {
        const value = translations[field];
        return value != null && value !== "" && value !== "null";
    }).length;
}
//# sourceMappingURL=compute-translated-field-count.js.map