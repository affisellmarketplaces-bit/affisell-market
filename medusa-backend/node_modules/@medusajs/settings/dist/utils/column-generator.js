"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEntityColumns = generateEntityColumns;
exports.computedColumnToAdminColumn = computedColumnToAdminColumn;
const utils_1 = require("@medusajs/framework/utils");
const computed_columns_1 = require("./computed-columns");
const entity_discovery_1 = require("./entity-discovery");
const entity_overrides_1 = require("./entity-overrides");
const filter_rules_1 = require("./filter-rules");
const relationship_filters_1 = require("./relationship-filters");
const render_mode_mapper_1 = require("./render-mode-mapper");
/**
 * Format a field name to display name.
 */
function formatFieldName(fieldName) {
    return fieldName
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .replace(/^\s+/, "")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}
/**
 * Map semantic type to a valid column category.
 */
function semanticTypeToCategory(semanticType) {
    switch (semanticType) {
        case "identifier":
            return "identifier";
        case "timestamp":
            return "timestamp";
        case "status":
            return "status";
        case "currency":
        case "count":
            return "metric";
        default:
            return "field";
    }
}
/**
 * Generate columns for an entity using the entity discovery service.
 */
function generateEntityColumns(entityDiscovery, entityKey, propertyLabels, customOverride) {
    if (!entityDiscovery.isInitialized()) {
        return null;
    }
    const entity = entityDiscovery.getEntity(entityKey);
    if (!entity) {
        return null;
    }
    const override = customOverride || (0, entity_overrides_1.getEntityOverride)(entity.name);
    const filterRules = (0, entity_overrides_1.getFieldFilterRules)(entity.name, override);
    const defaultVisibleFields = (0, entity_overrides_1.getDefaultVisibleFields)(entity.name, override);
    const fieldOrdering = (0, entity_overrides_1.getFieldOrdering)(entity.name, override);
    const additionalTypes = (0, entity_overrides_1.getAdditionalTypes)(entity.name, override);
    const nonFilterableFields = (0, entity_overrides_1.getNonFilterableFields)(entity.name, override);
    const schemaTypeMap = entityDiscovery.getSchemaTypeMap();
    const columns = [];
    const processedFields = new Set();
    // Process main entity type
    processEntityType(schemaTypeMap, entity.graphqlType, entity, columns, processedFields, filterRules, defaultVisibleFields, fieldOrdering, nonFilterableFields, propertyLabels);
    // Process additional types (e.g., OrderDetail for Order)
    for (const additionalType of additionalTypes) {
        const type = schemaTypeMap[additionalType];
        if (type) {
            processEntityType(schemaTypeMap, additionalType, entity, columns, processedFields, filterRules, defaultVisibleFields, fieldOrdering, nonFilterableFields, propertyLabels);
        }
    }
    // Add computed columns
    const computedColumnRegistry = (0, computed_columns_1.getComputedColumnRegistry)();
    const computedColumns = computedColumnRegistry.getForEntity(entity.name);
    for (const computed of computedColumns) {
        const columnId = computed.id;
        if (processedFields.has(columnId)) {
            continue;
        }
        const label = propertyLabels?.get(columnId);
        const hasCustomLabel = !!label;
        columns.push({
            id: columnId,
            name: label?.label || computed.name,
            description: label?.description || computed.description,
            field: columnId,
            sortable: false,
            hideable: true,
            default_visible: computed.defaultVisible || defaultVisibleFields.includes(columnId),
            data_type: "string",
            semantic_type: "computed",
            context: "display",
            computed: {
                type: computed.renderMode,
                required_fields: computed.requiredFields,
                optional_fields: computed.optionalFields || [],
            },
            render_mode: computed.renderMode,
            default_order: fieldOrdering[columnId] || 850,
            category: computed.category ||
                "computed",
            filter: { enabled: false },
            source: { module: entity.module, entity: entity.name },
            custom_label: hasCustomLabel,
            label_id: label?.id,
        });
    }
    // Sort columns by default_order
    columns.sort((a, b) => (a.default_order || 1000) - (b.default_order || 1000));
    return columns;
}
/**
 * Process a GraphQL type and add columns.
 */
function processEntityType(schemaTypeMap, typeName, entity, columns, processedFields, filterRules, defaultVisibleFields, fieldOrdering, nonFilterableFields, propertyLabels, parentPath = "") {
    const type = schemaTypeMap[typeName];
    if (!type || !type.getFields) {
        return;
    }
    const fields = type.getFields();
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
        // Skip if already processed
        if (processedFields.has(fullPath)) {
            continue;
        }
        // Skip excluded fields
        if ((0, filter_rules_1.shouldExcludeField)(fieldName, filterRules)) {
            continue;
        }
        const fieldType = fieldDef.type;
        const underlyingType = (0, entity_discovery_1.getUnderlyingType)(fieldType);
        const isArray = (0, entity_discovery_1.isArrayField)(fieldType);
        // Handle scalar and enum types
        if ((0, utils_1.isScalarType)(underlyingType) || (0, utils_1.isEnumType)(underlyingType)) {
            const graphqlTypeName = underlyingType.name;
            const dataType = (0, render_mode_mapper_1.inferDataType)(graphqlTypeName, fieldName);
            const { renderMode, semanticType } = (0, render_mode_mapper_1.inferRenderMode)(fieldName, graphqlTypeName);
            const label = propertyLabels?.get(fullPath);
            const hasCustomLabel = !!label;
            processedFields.add(fullPath);
            const filter = nonFilterableFields.includes(fullPath)
                ? { enabled: false }
                : (0, filter_rules_1.buildFilterConfig)(fieldName, dataType, false, semanticType, (0, utils_1.isEnumType)(underlyingType)
                    ? underlyingType.getValues().map((v) => v.value)
                    : undefined);
            columns.push({
                id: fullPath,
                name: label?.label || formatFieldName(fieldName),
                description: label?.description || undefined,
                field: fullPath,
                sortable: !parentPath, // Only top-level fields are sortable
                hideable: true,
                default_visible: defaultVisibleFields.includes(fullPath),
                data_type: dataType,
                semantic_type: semanticType,
                context: "both",
                render_mode: renderMode,
                default_order: fieldOrdering[fullPath] || 900,
                category: parentPath
                    ? "relationship"
                    : semanticTypeToCategory(semanticType),
                filter,
                source: { module: entity.module, entity: entity.name },
                custom_label: hasCustomLabel,
                label_id: label?.id,
            });
        }
        // Handle single relationships (many-to-one, one-to-one)
        else if ((0, entity_discovery_1.isSingleRelationship)(fieldType) &&
            underlyingType instanceof utils_1.GraphQLObjectType) {
            // Process nested fields with dot notation (one level deep)
            if (!parentPath) {
                const relatedTypeName = underlyingType.name;
                const shouldIncludeRelationship = true;
                // Get scalar fields from the related entity
                const relatedFields = underlyingType.getFields();
                // Process all scalar fields of the relationship
                for (const [relatedFieldName, relatedFieldDef] of Object.entries(relatedFields)) {
                    const nestedPath = `${fieldName}.${relatedFieldName}`;
                    const nestedFieldType = relatedFieldDef.type;
                    const nestedUnderlyingType = (0, entity_discovery_1.getUnderlyingType)(nestedFieldType);
                    // Only include scalar fields (not nested objects or arrays)
                    if ((0, utils_1.isScalarType)(nestedUnderlyingType) &&
                        !processedFields.has(nestedPath)) {
                        const graphqlTypeName = nestedUnderlyingType.name;
                        const dataType = (0, render_mode_mapper_1.inferDataType)(graphqlTypeName, relatedFieldName);
                        const { renderMode, semanticType } = (0, render_mode_mapper_1.inferRenderMode)(relatedFieldName, graphqlTypeName);
                        const label = propertyLabels?.get(nestedPath);
                        const hasCustomLabel = !!label;
                        processedFields.add(nestedPath);
                        const filter = nonFilterableFields.includes(nestedPath)
                            ? { enabled: false }
                            : (0, filter_rules_1.buildFilterConfig)(relatedFieldName, dataType, false, semanticType);
                        // Note: nested .id paths in nonFilterableFields produce
                        // { enabled: false, relationship: {...} }; not currently reachable.
                        if (shouldIncludeRelationship && relatedFieldName === "id") {
                            const relationshipFilter = (0, relationship_filters_1.getRelationshipFilterConfig)(entity.name, fieldName, relatedTypeName, false, schemaTypeMap);
                            if (relationshipFilter) {
                                filter.relationship = relationshipFilter;
                            }
                        }
                        columns.push({
                            id: nestedPath,
                            name: label?.label ||
                                `${formatFieldName(fieldName)} ${formatFieldName(relatedFieldName)}`,
                            description: label?.description || undefined,
                            field: nestedPath,
                            sortable: false,
                            hideable: true,
                            default_visible: defaultVisibleFields.includes(nestedPath),
                            data_type: dataType,
                            semantic_type: semanticType,
                            context: "both",
                            render_mode: renderMode,
                            default_order: fieldOrdering[nestedPath] || 950,
                            category: "relationship",
                            filter,
                            source: { module: entity.module, entity: entity.name },
                            custom_label: hasCustomLabel,
                            label_id: label?.id,
                        });
                    }
                }
            }
        }
        // Handle array relationships for relationship filter dropdowns
        else if (isArray && underlyingType instanceof utils_1.GraphQLObjectType) {
            const relatedTypeName = underlyingType.name;
            // Add a relationship filter if this is a filterable entity
            if (!parentPath) {
                const relationshipFilter = (0, relationship_filters_1.getRelationshipFilterConfig)(entity.name, fieldName, relatedTypeName, true, schemaTypeMap);
                if (relationshipFilter) {
                    const label = propertyLabels?.get(fieldName);
                    const hasCustomLabel = !!label;
                    // Add as a virtual filterable column
                    columns.push({
                        id: `${fieldName}_filter`,
                        name: label?.label || formatFieldName(fieldName),
                        description: label?.description || undefined,
                        field: `${fieldName}.id`,
                        sortable: false,
                        hideable: true,
                        default_visible: false,
                        data_type: "string",
                        semantic_type: "relationship",
                        context: "filter",
                        render_mode: "text",
                        default_order: 980,
                        category: "relationship",
                        filter: {
                            enabled: true,
                            operators: ["in"],
                            relationship: relationshipFilter,
                        },
                        source: { module: entity.module, entity: entity.name },
                        custom_label: hasCustomLabel,
                        label_id: label?.id,
                    });
                }
            }
        }
    }
}
/**
 * Convert a computed column definition to an AdminColumn.
 */
function computedColumnToAdminColumn(column, entity, defaultOrder = 850, label) {
    return {
        id: column.id,
        name: label?.label || column.name,
        description: label?.description || column.description,
        field: column.id,
        sortable: false,
        hideable: true,
        default_visible: column.defaultVisible ?? false,
        data_type: "string",
        semantic_type: "computed",
        context: "display",
        computed: {
            type: column.renderMode,
            required_fields: column.requiredFields,
            optional_fields: column.optionalFields || [],
        },
        render_mode: column.renderMode,
        default_order: defaultOrder,
        category: column.category || "computed",
        filter: { enabled: false },
        source: { module: entity.module, entity: entity.name },
        custom_label: !!label,
        label_id: label?.id,
    };
}
//# sourceMappingURL=column-generator.js.map