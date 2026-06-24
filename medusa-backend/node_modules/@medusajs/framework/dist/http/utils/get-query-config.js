"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickByConfig = pickByConfig;
exports.prepareListQuery = prepareListQuery;
exports.prepareRetrieveQuery = prepareRetrieveQuery;
const utils_1 = require("@medusajs/utils");
const field_filtering_1 = require("./field-filtering");
const rbac_field_filter_1 = require("./policies/rbac-field-filter");
function pickByConfig(obj, config) {
    const fields = [...(config.select ?? []), ...(config.relations ?? [])];
    if (fields.length) {
        if (Array.isArray(obj)) {
            return obj.map((o) => (0, utils_1.pickDeep)(o, fields));
        }
        else {
            return (0, utils_1.pickDeep)(obj, fields);
        }
    }
    return obj;
}
async function prepareListQuery(validated, queryConfig = {}, req) {
    let { allowed = [], restricted = [], defaults = [], defaultLimit = 50, isList, entity, } = queryConfig;
    const { order, fields, limit = defaultLimit, offset = 0, with_deleted, } = validated;
    const parsedFields = field_filtering_1.FieldParser.parse(fields, defaults);
    const { fields: allFields, starFields } = parsedFields;
    const rbacFilterFieldsFeatureFlag = utils_1.FeatureFlag.isFeatureEnabled("rbac_filter_fields");
    const filters = [];
    if (req?.policies && entity && rbacFilterFieldsFeatureFlag) {
        filters.push(new rbac_field_filter_1.RBACFieldFilter({
            policies: req.policies,
            userRoles: req.auth_context?.app_metadata?.roles || [],
            container: req.scope,
        }));
    }
    if (allowed.length) {
        filters.push(new field_filtering_1.AllowedFieldFilter({ allowed }));
    }
    else if (restricted.length) {
        filters.push(new field_filtering_1.RestrictedFieldFilter({ restricted }));
    }
    const notAllowedArrays = await (0, utils_1.promiseAll)(filters.map((f) => f.getNotAllowedFields({ entity: entity, parsedFields })));
    const notAllowedFields = [...new Set(notAllowedArrays.flat())];
    if (notAllowedFields.length && rbacFilterFieldsFeatureFlag) {
        notAllowedFields.forEach((field) => {
            allFields.delete(field);
            starFields.delete(field);
        });
    }
    // TODO: maintain backward compatibility, remove in the future
    const { select, relations } = (0, utils_1.stringToSelectRelationObject)(Array.from(allFields));
    let allRelations = new Set([...relations, ...Array.from(starFields)]);
    // End of expand compatibility
    let orderBy = {};
    if ((0, utils_1.isDefined)(order)) {
        let orderField = order;
        if (order.startsWith("-")) {
            orderField = order.slice(1);
            orderBy = { [orderField]: "DESC" };
        }
        else {
            orderBy = { [order]: "ASC" };
        }
        if (allowed.length && !allowed.includes(orderField)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Order field ${orderField} is not valid`);
        }
    }
    const finalOrder = (0, utils_1.isPresent)(orderBy) ? (0, utils_1.buildOrder)(orderBy) : undefined;
    return {
        listConfig: {
            select: select.length ? select : undefined,
            relations: Array.from(allRelations),
            skip: offset,
            take: limit,
            order: finalOrder,
            withDeleted: with_deleted,
        },
        remoteQueryConfig: {
            ...(!!entity ? { entity } : {}),
            // Add starFields that are relations only on which we want all properties with a dedicated format to the remote query
            fields: [
                ...Array.from(allFields),
                ...Array.from(starFields).map((f) => `${f}.*`),
            ],
            pagination: isList
                ? {
                    skip: offset,
                    take: limit,
                    order: finalOrder,
                }
                : {},
            withDeleted: with_deleted,
        },
    };
}
async function prepareRetrieveQuery(validated, queryConfig, req) {
    const { listConfig, remoteQueryConfig } = await prepareListQuery(validated, queryConfig, req);
    return {
        retrieveConfig: {
            select: listConfig.select,
            relations: listConfig.relations,
        },
        remoteQueryConfig: {
            fields: remoteQueryConfig.fields,
            pagination: {},
            withDeleted: remoteQueryConfig.withDeleted,
        },
    };
}
//# sourceMappingURL=get-query-config.js.map