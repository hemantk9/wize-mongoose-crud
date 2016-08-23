export function isValidJSON(data: string): any {
    try {
        let _out = JSON.parse(data);
        return _out;
    } catch (e) {
        return false;
    }
}
export function isAccessible (userRoles: Array<any>, schemaRoles: Array<any>): boolean {
    schemaRoles = schemaRoles && typeof schemaRoles == 'object' ? schemaRoles : [];
    let hasAccess = false;
    if (schemaRoles.length == 0) {
        hasAccess = true;
    } else if (userRoles.length > 0) {
        for (var i of userRoles) {
            if (schemaRoles.indexOf(i) > -1) {
                hasAccess = true;
                break;
            }
        }
    }
    return hasAccess;
}