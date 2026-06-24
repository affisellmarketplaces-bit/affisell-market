"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaults = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["tax_provider"] = "tax_provider";
})(Entities || (exports.Entities = Entities = {}));
exports.defaults = ["id", "is_enabled"];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaults,
    isList: false,
    entity: Entities.tax_provider,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.tax_provider,
};
//# sourceMappingURL=query-config.js.map