import {objectById} from "../store";
import {getObject} from "../object";

/**
 *  @return undefined if the account name is not yet cached, and fetch the the full account if not already pending
 *  @return null if the account name or id are unvalid, or the account does not exist
 *  @return the account name
 */
export const getAccountName = id => {
    let account = objectById.get(id);
    if (account === true) return undefined;
    if (!account) {
        getObject(id, false, false, true);
        return undefined;
    }
    return account.get("name");
};
