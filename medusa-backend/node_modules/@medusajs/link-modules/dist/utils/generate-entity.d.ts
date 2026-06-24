import { JoinerRelationship, ModuleJoinerConfig } from "@medusajs/framework/types";
import { EntitySchema } from "@medusajs/framework/mikro-orm/core";
export declare function generateEntity(joinerConfig: ModuleJoinerConfig, primary: JoinerRelationship, foreign: JoinerRelationship): EntitySchema<{
    id: any;
} & {
    deleted_at: any;
} & {
    id: any;
} & {
    deleted_at: any;
}, never>;
//# sourceMappingURL=generate-entity.d.ts.map