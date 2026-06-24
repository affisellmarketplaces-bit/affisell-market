"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminLocaleFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["store_locale"] = "store_locale";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminLocaleFields = ["code", "name"];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminLocaleFields,
    isList: false,
    entity: Entities.store_locale,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaultLimit: 200,
    isList: true,
    entity: Entities.store_locale,
};
//# sourceMappingURL=query-config.js.map