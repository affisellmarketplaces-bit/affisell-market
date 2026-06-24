"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminCampaignFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["campaign"] = "campaign";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminCampaignFields = [
    "id",
    "name",
    "description",
    "currency",
    "campaign_identifier",
    "*budget",
    "starts_at",
    "ends_at",
    "created_at",
    "updated_at",
    "deleted_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminCampaignFields,
    isList: false,
    entity: Entities.campaign,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.campaign,
};
//# sourceMappingURL=query-config.js.map