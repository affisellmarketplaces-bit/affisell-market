import { PluginDetails } from "@medusajs/types";
/**
 * Writes `<directory>/.medusa/types/plugin-augmentations.d.ts` with a
 * `/// <reference types="…" />` directive for each installed plugin whose
 * package exposes root types.
 */
export declare function generatePluginAugmentations({ directory, plugins, }: {
    directory: string;
    plugins: PluginDetails[];
}): Promise<void>;
//# sourceMappingURL=generate-plugin-augmentations.d.ts.map