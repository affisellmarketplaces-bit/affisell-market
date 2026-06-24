import { HttpTypes } from "@medusajs/types";
import { Client } from "../client.js";
import { ClientHeaders } from "../types.js";
export declare class Plugin {
    /**
     * @ignore
     */
    private client;
    /**
     * @ignore
     */
    constructor(client: Client);
    /**
     * This method retrieves the list of plugins installed in a Medusa application.
     *
     * @param headers - Headers to pass in the request.
     * @returns The list of plugins.
     *
     * @example
     * sdk.admin.plugin.list()
     * .then(({ plugins }) => {
     *   console.log(plugins)
     * })
     */
    list(headers?: ClientHeaders): Promise<HttpTypes.AdminPluginsListResponse>;
}
//# sourceMappingURL=plugin.d.ts.map