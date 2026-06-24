"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const config = req.scope.resolve(utils_1.ContainerRegistrationKeys.CONFIG_MODULE);
    res.status(200).json({
        enabled: !!config.projectConfig.http.authMethodsPerActor?.user?.includes("cloud"),
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map