import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import {notifySubscribers} from "../subscribe";
import {accountIdsByKey, getAccountRefsOfKeysCalls} from "../store";

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
