import { LoadedModule, MedusaContainer } from "@medusajs/framework/types";
import { GraphQLSchema } from "@medusajs/framework/utils";
import { Express } from "express";
type Options = {
    directory: string;
    expressApp: Express;
    skipLoadingEntryPoints?: boolean;
};
export declare function initializeContainer(rootDirectory: string, options?: {
    skipDbConnection?: boolean;
    throwOnValidationError?: boolean;
}): Promise<MedusaContainer>;
declare const _default: ({ directory: rootDirectory, expressApp, skipLoadingEntryPoints, }: Options) => Promise<{
    container: MedusaContainer;
    app: Express;
    modules: Record<string, LoadedModule | LoadedModule[]>;
    shutdown: () => Promise<void>;
    gqlSchema?: GraphQLSchema;
}>;
export default _default;
//# sourceMappingURL=index.d.ts.map