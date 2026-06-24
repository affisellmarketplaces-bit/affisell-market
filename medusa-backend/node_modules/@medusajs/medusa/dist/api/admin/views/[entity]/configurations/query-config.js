"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveViewConfiguration = exports.retrieveViewConfigurationList = exports.defaultViewConfigurationFields = void 0;
exports.defaultViewConfigurationFields = [
    "id",
    "entity",
    "name",
    "user_id",
    "is_system_default",
    "configuration",
    "created_at",
    "updated_at",
];
exports.retrieveViewConfigurationList = {
    defaults: exports.defaultViewConfigurationFields,
    isList: true,
};
exports.retrieveViewConfiguration = {
    defaults: exports.defaultViewConfigurationFields,
    isList: false,
};
//# sourceMappingURL=query-config.js.map