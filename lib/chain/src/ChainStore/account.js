import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import ChainValidation from "../ChainValidation";
import {notifySubscribers} from "./subscribe";
import {
    objectById,
    accountIdsByKey,
    accountIdsByAccount,
    accountHistoryRequests,
    getAccountRefsOfKeysCalls,
    getAccountRefsOfAccountsCalls
} from "./store";
import {OP_HISTORY} from "./utils";

export const getAccountMemberStatus = account => {
    if (account === undefined) return undefined;
    if (account === null) return "unknown";
    if (account.get("lifetime_referrer") == account.get("id"))
        return "lifetime";
    let exp = new Date(account.get("membership_expiration_date")).getTime();
    let now = new Date().getTime();
    if (exp < now) return "basic";
    return "annual";
};

export const getAccountBalance = (account, asset_type) => {
    let balances = account.get("balances");
    if (!balances) return 0;

    let balance_obj_id = balances.get(asset_type);
    if (balance_obj_id) {
        let bal_obj = objectById.get(balance_obj_id);
        if (bal_obj) return bal_obj.get("balance");
    }
    return 0;
};

/**
 *  @param the public key to find accounts that reference it
 *
 *  @return Set of account ids that reference the given key
 *  @return a empty Set if no items are found
 *  @return undefined if the result is unknown
 *
 *  If this method returns undefined, then it will send a request to
 *  the server for the current set of accounts after which the
 *  server will notify us of any accounts that reference these keys
 */
export const getAccountRefsOfKey = key => {
    if (getAccountRefsOfKeysCalls.has(key)) return accountIdsByKey.get(key);
    else {
        getAccountRefsOfKeysCalls.add(key);

        Apis.db
            .get_key_references([key])
            .then(vec_account_id => {
                let refs = Immutable.Set();
                vec_account_id = vec_account_id[0];
                refs = refs.withMutations(r => {
                    for (let i = 0; i < vec_account_id.length; ++i) {
                        r.add(vec_account_id[i]);
                    }
                });
                accountIdsByKey.set(key, refs);
                notifySubscribers();
            })
            .catch(err => {
                console.error("get_key_references", err);
                accountIdsByKey.delete(key);
                getAccountRefsOfKeysCalls.delete(key);
            });
        return undefined;
    }
    //return undefined;
};

/**
 *  @param the account id to find accounts that reference it
 *
 *  @return Set of account ids that reference the given key
 *  @return a empty Set if no items are found
 *  @return undefined if the result is unknown
 *
 *  If this method returns undefined, then it will send a request to
 *  the server for the current set of accounts after which the
 *  server will notify us of any accounts that reference these keys
 */
export const getAccountRefsOfAccount = account_id => {
    if (getAccountRefsOfAccountsCalls.has(account_id))
        return accountIdsByAccount.get(account_id);
    else {
        getAccountRefsOfAccountsCalls.add(account_id);

        Apis.db
            .get_account_references(account_id)
            .then(vec_account_id => {
                let refs = Immutable.Set();
                refs = refs.withMutations(r => {
                    for (let i = 0; i < vec_account_id.length; ++i) {
                        r.add(vec_account_id[i]);
                    }
                });
                accountIdsByAccount.set(account_id, refs);
                notifySubscribers();
            })
            .catch(err => {
                console.error("get_account_references", err);
                accountIdsByAccount.delete(account_id);
                getAccountRefsOfAccountsCalls.delete(account_id);
            });
        return undefined;
    }
    //return undefined;
};

/**
 * There are two ways to extend the account history, add new more
 * recent history, and extend historic hstory. This method will fetch
 * the most recent account history and prepend it to the list of
 * historic operations.
 *
 *  @param account immutable account object
 *  @return a promise with the account history
 */
export const fetchRecentHistory = (account, limit = 100) => {
    // console.log( "get account history: ", account )
    /// TODO: make sure we do not submit a query if there is already one
    /// in flight...
    let account_id = account;
    if (!ChainValidation.is_object_id(account_id) && account.toJS)
        account_id = account.get("id");

    if (!ChainValidation.is_object_id(account_id)) return;

    account = objectById.get(account_id);
    if (!account || account === true) return;

    let pending_request = accountHistoryRequests.get(account_id);
    if (pending_request) {
        pending_request.requests++;
        return pending_request.promise;
    } else pending_request = {requests: 0};

    let most_recent = "1." + OP_HISTORY + ".0";
    let history = account.get("history");

    if (history && history.size) most_recent = history.first().get("id");

    /// starting at 0 means start at NOW, set this to something other than 0
    /// to skip recent transactions and fetch the tail
    let start = "1." + OP_HISTORY + ".0";

    pending_request.promise = new Promise((resolve, reject) => {
        Apis.history
            .get_account_history(account_id, most_recent, limit, start)
            .then(operations => {
                let current_account = objectById.get(account_id);
                if (typeof current_account !== "object") return;
                //console.log("current_account", current_account);
                let current_history = current_account.get("history");
                if (!current_history) current_history = Immutable.List();
                let updated_history = Immutable.fromJS(operations);
                updated_history = updated_history.withMutations(list => {
                    for (let i = 0; i < current_history.size; ++i)
                        list.push(current_history.get(i));
                });
                let updated_account = current_account.set(
                    "history",
                    updated_history
                );
                objectById.set(account_id, updated_account);

                //if( current_history != updated_history )
                //   _notifyAccountSubscribers( account_id )

                let pending_request = accountHistoryRequests.get(account_id);
                accountHistoryRequests.delete(account_id);
                if (pending_request.requests > 0) {
                    // it looks like some more history may have come in while we were
                    // waiting on the result, lets fetch anything new before we resolve
                    // this query.
                    fetchRecentHistory(updated_account, limit).then(
                        resolve,
                        reject
                    );
                } else resolve(updated_account);
            }); // end then
    });

    accountHistoryRequests.set(account_id, pending_request);
    return pending_request.promise;
};
