"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveUploadConfig = exports.defaultAdminUploadFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["file"] = "file";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminUploadFields = ["id", "url"];
exports.retrieveUploadConfig = {
    defaults: exports.defaultAdminUploadFields,
    isList: false,
    entity: Entities.file,
};
//# sourceMappingURL=query-config.js.map