"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSecretApiKeyContext = setSecretApiKeyContext;
const utils_1 = require("@medusajs/utils");
async function setSecretApiKeyContext(req, _, next) {
    const shouldSkip = req.auth_context?.actor_type !== "api-key";
    if (shouldSkip) {
        return next();
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [apiKey], } = await query.graph({
        entity: "api_key",
        fields: ["created_by"],
        filters: {
            id: req.auth_context.actor_id,
        },
        withDeleted: true,
    }, {
        cache: {
            enable: true,
        },
    });
    if (!apiKey) {
        throw new utils_1.MedusaError(utils_1.MedusaErrorTypes.NOT_FOUND, `API key with id ${req.auth_context.actor_id} not found`);
    }
    req.secret_key_context = {
        created_by: apiKey.created_by,
    };
    next();
}
//# sourceMappingURL=set-secret-api-key-context.js.map