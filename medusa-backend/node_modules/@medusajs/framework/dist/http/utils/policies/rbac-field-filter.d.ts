import { PolicyDefinition } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/types";
import { FieldFilterContext, IFieldFilter } from "../field-filtering/index";
/**
 * RBAC Field Filter using the Strategy pattern
 * Optimized for parallel permission checks
 */
export declare class RBACFieldFilter implements IFieldFilter {
    private policies;
    private userRoles;
    private container;
    constructor({ policies, userRoles, container, }: {
        policies: PolicyDefinition[];
        userRoles: string[];
        container: MedusaContainer;
    });
    getNotAllowedFields(context: FieldFilterContext): Promise<string[]>;
}
//# sourceMappingURL=rbac-field-filter.d.ts.map