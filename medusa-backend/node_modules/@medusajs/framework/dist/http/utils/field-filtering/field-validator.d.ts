import { FieldFilterContext, IFieldFilter } from "./index";
/**
 * Filter that only allows explicitly specified fields
 * Fields not in the allowed list are returned as not allowed
 */
export declare class AllowedFieldFilter implements IFieldFilter {
    private allowed;
    constructor({ allowed }: {
        allowed: string[];
    });
    getNotAllowedFields(context: FieldFilterContext): string[];
}
/**
 * Filter that restricts specific fields
 * Fields containing any restricted segment are returned as not allowed
 */
export declare class RestrictedFieldFilter implements IFieldFilter {
    private restricted;
    constructor({ restricted }: {
        restricted: string[];
    });
    getNotAllowedFields(context: FieldFilterContext): string[];
}
//# sourceMappingURL=field-validator.d.ts.map