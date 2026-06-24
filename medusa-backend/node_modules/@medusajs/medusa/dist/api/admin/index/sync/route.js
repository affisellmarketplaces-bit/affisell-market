"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.11.2
 * @featureFlag index
 */
const POST = async (req, res) => {
    const indexService = req.scope.resolve(utils_1.Modules.INDEX);
    const strategy = req.validatedBody.strategy;
    await indexService.sync({ strategy });
    res.send(200);
};
exports.POST = POST;
//# sourceMappingURL=route.js.map