import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import ChainValidation from "../../ChainValidation";
import {objectById, accountHistoryRequests} from "../store";
import {OP_HISTORY} from "../utils";

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
