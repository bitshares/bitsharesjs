import ChainValidation from "../../ChainValidation";
import {DEFAULT_AUTO_SUBSCRIBE} from "../utils";
import {getFullAccountsSubscriptions, accountsByName} from "../store";
import {_subTo} from "../subscribe";
import {getObject} from "../object";
import {fetchFullAccount} from "./fetchFullAccount";

/**
 *  @return null if no such account exists
 *  @return undefined if such an account may exist, and fetch the the full account if not already pending
 *  @return the account object if it does exist
 */
export const getAccount = (name_or_id, autosubscribe = null) => {
    if (autosubscribe == null) {
        autosubscribe = DEFAULT_AUTO_SUBSCRIBE;
    }
    if (!name_or_id) return null;

    if (typeof name_or_id === "object") {
        if (name_or_id.id) return getAccount(name_or_id.id, autosubscribe);
        else if (name_or_id.get)
            return getAccount(name_or_id.get("id"), autosubscribe);
        else return undefined;
    }

    if (ChainValidation.is_object_id(name_or_id)) {
        let account = getObject(name_or_id, false, autosubscribe);
        if (account === null) {
            return null;
        }
        /* If sub status changes from false to true, force full fetch */
        const currentSub = getFullAccountsSubscriptions.get(name_or_id, false);
        if (
            (!currentSub && autosubscribe) ||
            account === undefined ||
            account.get("name") === undefined
        ) {
            return fetchFullAccount(name_or_id, autosubscribe);
        }
        return account;
    } else if (ChainValidation.is_account_name(name_or_id, true)) {
        let account_id = accountsByName.get(name_or_id);
        if (account_id === null) return null; // already fetched and it wasn't found
        if (account_id === undefined)
            // then no query, fetch it
            return fetchFullAccount(name_or_id, autosubscribe);

        return getObject(account_id, false, autosubscribe); // return it
    } else {
        return null;
    }
    //throw Error( `Argument is not an account name or id: ${name_or_id}` )
};
