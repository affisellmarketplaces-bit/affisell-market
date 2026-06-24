"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreLocales = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.StoreLocales = {
    [utils_1.MEDUSA_SKIP_FILE]: !(utils_1.FeatureFlag.isFeatureEnabled("translation") ||
        process.env.MEDUSA_FF_TRANSLATION === "true"),
    isLink: true,
    isReadOnlyLink: true,
    extends: [
        {
            serviceName: utils_1.Modules.STORE,
            entity: "StoreLocale",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Locale",
                primaryKey: "code",
                foreignKey: "locale_code",
                alias: "locale",
                args: {
                    methodSuffix: "Locales",
                },
            },
        },
    ],
};
//# sourceMappingURL=store-locale.js.map