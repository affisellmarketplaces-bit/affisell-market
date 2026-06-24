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
export declare function computeTranslatedFieldCount(translations: Record<string, unknown> | undefined | null, translatableFields: string[] | undefined | null): number;
//# sourceMappingURL=compute-translated-field-count.d.ts.map