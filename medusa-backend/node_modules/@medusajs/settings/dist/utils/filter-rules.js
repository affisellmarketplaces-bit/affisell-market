"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FIELD_FILTER_RULES = void 0;
exports.isFilterable = isFilterable;
exports.getFilterOperators = getFilterOperators;
exports.buildFilterConfig = buildFilterConfig;
exports.shouldExcludeField = shouldExcludeField;
/**
 * Data types that are not filterable by default.
 */
const NON_FILTERABLE_TYPES = ["object"];
/**
 * Field name patterns that are not filterable.
 */
const NON_FILTERABLE_PATTERNS = [
    /^raw_/, // Raw data fields
    /^metadata$/, // Metadata JSON fields
    /_link$/, // Link fields
];
/**
 * Semantic types that are not filterable.
 */
const NON_FILTERABLE_SEMANTIC_TYPES = ["object", "json", "metadata"];
/**
 * Filter operators by data type.
 */
const FILTER_OPERATORS_BY_TYPE = {
    string: ["eq", "ne", "contains", "startsWith", "endsWith", "in", "nin"],
    number: ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"],
    boolean: ["eq"],
    date: ["eq", "ne", "gt", "gte", "lt", "lte"],
    currency: ["eq", "ne", "gt", "gte", "lt", "lte"],
    enum: ["eq", "ne", "in", "nin"],
    object: [],
};
/**
 * Check if a field is filterable based on name, data type, and whether it's computed.
 */
function isFilterable(fieldName, dataType, isComputed, semanticType) {
    // Computed columns are not filterable
    if (isComputed) {
        return false;
    }
    // Check non-filterable types
    if (NON_FILTERABLE_TYPES.includes(dataType)) {
        return false;
    }
    // Check field name patterns
    for (const pattern of NON_FILTERABLE_PATTERNS) {
        if (pattern.test(fieldName)) {
            return false;
        }
    }
    // Check semantic types
    if (semanticType && NON_FILTERABLE_SEMANTIC_TYPES.includes(semanticType)) {
        return false;
    }
    return true;
}
/**
 * Get available filter operators for a data type.
 */
function getFilterOperators(dataType) {
    return FILTER_OPERATORS_BY_TYPE[dataType] || [];
}
/**
 * Build the filter configuration for a column.
 */
function buildFilterConfig(fieldName, dataType, isComputed, semanticType, enumValues) {
    const filterable = isFilterable(fieldName, dataType, isComputed, semanticType);
    if (!filterable) {
        return { enabled: false };
    }
    const operators = getFilterOperators(dataType);
    return {
        enabled: true,
        operators: operators.length > 0 ? operators : undefined,
        enumValues: dataType === "enum" ? enumValues : undefined,
    };
}
/**
 * Global default filter rules applied to all entities.
 */
exports.DEFAULT_FIELD_FILTER_RULES = {
    excludeSuffixes: ["_link"],
    excludePrefixes: ["raw_"],
    excludeFields: [],
};
/**
 * Check if a field should be excluded based on filter rules.
 */
function shouldExcludeField(fieldName, filterRules = exports.DEFAULT_FIELD_FILTER_RULES) {
    // Check if field matches any exclude suffixes
    if (filterRules.excludeSuffixes?.some((suffix) => fieldName.endsWith(suffix))) {
        return true;
    }
    // Check if field matches any exclude prefixes
    if (filterRules.excludePrefixes?.some((prefix) => fieldName.startsWith(prefix))) {
        return true;
    }
    // Check if field is in the exclude fields list
    if (filterRules.excludeFields?.includes(fieldName)) {
        return true;
    }
    return false;
}
//# sourceMappingURL=filter-rules.js.map