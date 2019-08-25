import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import {notifySubscribers} from "../subscribe";
import {accountIdsByAccount, getAccountRefsOfAccountsCalls} from "../store";

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
