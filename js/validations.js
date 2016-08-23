"use strict";
function isValidJSON(data) {
    try {
        let _out = JSON.parse(data);
        return _out;
    }
    catch (e) {
        return false;
    }
}
exports.isValidJSON = isValidJSON;
function isAccessible(userRoles, schemaRoles) {
    schemaRoles = schemaRoles && typeof schemaRoles == 'object' ? schemaRoles : [];
    let hasAccess = false;
    if (schemaRoles.length == 0) {
        hasAccess = true;
    }
    else if (userRoles.length > 0) {
        for (var i of userRoles) {
            if (schemaRoles.indexOf(i) > -1) {
                hasAccess = true;
                break;
            }
        }
    }
    return hasAccess;
}
exports.isAccessible = isAccessible;
//# sourceMappingURL=validations.js.map