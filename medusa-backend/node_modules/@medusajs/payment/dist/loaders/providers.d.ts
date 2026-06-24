import { LoaderOptions, ModuleProvider, ModulesSdkTypes } from "@medusajs/framework/types";
declare const _default: ({ container, options, }: LoaderOptions<(ModulesSdkTypes.ModuleServiceInitializeOptions | ModulesSdkTypes.ModuleServiceInitializeCustomDataLayerOptions) & {
    providers: ModuleProvider[];
    cloud: {
        api_key?: string;
        endpoint?: string;
        environment_handle?: string;
        sandbox_handle?: string;
        webhook_secret?: string;
    };
}>) => Promise<void>;
export default _default;
//# sourceMappingURL=providers.d.ts.map