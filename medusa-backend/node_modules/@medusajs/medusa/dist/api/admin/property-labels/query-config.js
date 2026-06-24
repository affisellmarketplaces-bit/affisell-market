"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultPropertyLabelFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["property_label"] = "property_label";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultPropertyLabelFields = [
    "id",
    "entity",
    "property",
    "label",
    "description",
    "created_at",
    "updated_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultPropertyLabelFields,
    isList: false,
    entity: Entities.property_label,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
};
//# sourceMappingURL=query-config.js.map