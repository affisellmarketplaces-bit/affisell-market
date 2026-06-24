import { Context } from "@medusajs/framework/types";
import { MikroOrmBase } from "@medusajs/framework/utils";
export declare class RbacRepository extends MikroOrmBase {
    constructor();
    listPoliciesForRole(roleId: string, sharedContext?: Context): Promise<any[]>;
    listPoliciesForRoles(roleIds: string[], sharedContext?: Context): Promise<Map<string, any[]>>;
    checkForCycle(roleId: string, parentId: string, sharedContext?: Context): Promise<boolean>;
}
//# sourceMappingURL=rbac.d.ts.map