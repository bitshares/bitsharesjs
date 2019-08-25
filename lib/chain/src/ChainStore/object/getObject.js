import ChainValidation from "../../ChainValidation";
import {objectById, getFullAccountsSubscriptions} from "../store";
import {DEFAULT_AUTO_SUBSCRIBE, ACCOUNT_PREFIX} from "../utils";

import {fetchObject} from "./fetchObject";

/**
 * There are three states an object id could be in:
 *
 * 1. undefined       - returned if a query is pending
 * 3. defined         - return an object
 * 4. null            - query return null
 *
 */
export const getObject = (
    id,
    force = false,
    autosubscribe = null,
    no_full_account = false
) => {
    if (autosubscribe == null) {
        autosubscribe = DEFAULT_AUTO_SUBSCRIBE;
    }
    if (!ChainValidation.is_object_id(id))
        throw Error("argument is not an object id: " + JSON.stringify(id));

    let result = objectById.get(id);
    let subChange =
        id.substring(0, ACCOUNT_PREFIX.length) == ACCOUNT_PREFIX &&
        !getFullAccountsSubscriptions.get(id, false) &&
        autosubscribe;

    if (result === null && !force) return result;
    if (result === undefined || force || subChange)
        return fetchObject(id, force, autosubscribe, no_full_account);
    if (result === true) return undefined;

    return result;
};
