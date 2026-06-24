"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminCurrencyFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["currency"] = "currency";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminCurrencyFields = [
    "code",
    "name",
    "symbol",
    "symbol_native",
    "decimal_digits",
    "rounding",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminCurrencyFields,
    isList: false,
    entity: Entities.currency,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    defaultLimit: 200,
    isList: true,
    entity: Entities.currency,
};
//# sourceMappingURL=query-config.js.map