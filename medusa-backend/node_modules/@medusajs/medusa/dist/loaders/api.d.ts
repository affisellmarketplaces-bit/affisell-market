import { MedusaContainer, PluginDetails } from "@medusajs/framework/types";
import { Express } from "express";
type Options = {
    app: Express;
    plugins: PluginDetails[];
    container: MedusaContainer;
};
declare const _default: ({ app, container, plugins }: Options) => Promise<Express>;
export default _default;
//# sourceMappingURL=api.d.ts.map