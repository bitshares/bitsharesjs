import {Apis} from "bitsharesjs-ws";
import Immutable from "immutable";
import ChainValidation from "../../ChainValidation";
import {DEFAULT_AUTO_SUBSCRIBE, DEBUG} from "../utils";
import {
    getFullAccountsSubscriptions,
    objectById,
    accountsByName,
    fetchingGetFullAccounts
} from "../store";
import {notifySubscribers, _subTo} from "../subscribe";
import {updateObject} from "../object";
import {getAccount} from "./getAccount";
import {fetchRecentHistory} from "./fetchRecentHistory";

//fetchRecentHistory

/**
 *  Fetches an account and all of its associated data in a single query
 *
 *  @param an account name or account id
 *
 *  @return undefined if the account in question is in the process of being fetched
 *  @return the object if it has already been fetched
 *  @return null if the object has been queried and was not found
 */
export const fetchFullAccount = (name_or_id, autosubscribe = null) => {
    if (autosubscribe == null) {
        autosubscribe = DEFAULT_AUTO_SUBSCRIBE;
    }
    if (DEBUG) console.log("Fetch full account: ", name_or_id);

    let fetch_account = false;
    const subChanged =
        getFullAccountsSubscriptions.has(name_or_id) &&
        (getFullAccountsSubscriptions.get(name_or_id) === false &&
            autosubscribe);

    const is_object_id = ChainValidation.is_object_id(name_or_id);
    const is_account_name =
        !is_object_id && ChainValidation.is_account_name(name_or_id, true);

    if (is_object_id && !subChanged) {
        let current = objectById.get(name_or_id);
        fetch_account = current === undefined;
        if (
            !fetch_account &&
            (current &&
                current.get &&
                current.get("name") &&
                current.has("balances"))
        )
            return current;
    } else if (!subChanged) {
        if (!is_account_name)
            throw Error("argument is not an account name: " + name_or_id);

        let account_id = accountsByName.get(name_or_id);
        if (ChainValidation.is_object_id(account_id))
            return getAccount(account_id, autosubscribe);
    }

    /// only fetch once every 5 seconds if it wasn't found, or if the subscribe status changed to true
    if (
        subChanged ||
        !fetchingGetFullAccounts.has(name_or_id) ||
        Date.now() - fetchingGetFullAccounts.get(name_or_id) > 5000
    ) {
        fetchingGetFullAccounts.set(name_or_id, Date.now());
        Apis.db
            .get_full_accounts([name_or_id], autosubscribe)
            .then(results => {
                if (results.length === 0) {
                    if (is_object_id) {
                        objectById.set(name_or_id, null);
                        notifySubscribers();
                    } else if (is_account_name) {
                        accountsByName.set(name_or_id, null);
                        notifySubscribers();
                    }
                    return;
                }
                let full_account = results[0][1];
                getFullAccountsSubscriptions.set(
                    full_account.account.name,
                    autosubscribe
                );
                getFullAccountsSubscriptions.set(
                    full_account.account.id,
                    autosubscribe
                );
                if (DEBUG) console.log("full_account: ", full_account);
                /* Add this account to list of subbed accounts */
                _subTo("accounts", full_account.account.id);
                let {
                    account,
                    assets,
                    vesting_balances,
                    statistics,
                    call_orders,
                    settle_orders,
                    limit_orders,
                    referrer_name,
                    registrar_name,
                    lifetime_referrer_name,
                    votes,
                    proposals
                } = full_account;

                accountsByName.set(account.name, account.id);
                account.assets = new Immutable.List(assets || []);
                account.referrer_name = referrer_name;
                account.lifetime_referrer_name = lifetime_referrer_name;
                account.registrar_name = registrar_name;
                account.balances = {};
                account.orders = new Immutable.Set();
                account.vesting_balances = new Immutable.Set();
                account.balances = new Immutable.Map();
                account.call_orders = new Immutable.Set();
                account.settle_orders = new Immutable.Set();
                account.proposals = new Immutable.Set();
                account.vesting_balances = account.vesting_balances.withMutations(
                    set => {
                        vesting_balances.forEach(vb => {
                            updateObject(vb);
                            set.add(vb.id);
                        });
                    }
                );

                let sub_to_objects = [];

                votes.forEach(v => updateObject(v));

                account.balances = account.balances.withMutations(map => {
                    full_account.balances.forEach(b => {
                        updateObject(b);
                        map.set(b.asset_type, b.id);
                        if (autosubscribe) sub_to_objects.push(b.id);
                    });
                });
                account.orders = account.orders.withMutations(set => {
                    limit_orders.forEach(order => {
                        updateObject(order);
                        set.add(order.id);
                        if (autosubscribe) sub_to_objects.push(order.id);
                    });
                });
                account.call_orders = account.call_orders.withMutations(set => {
                    call_orders.forEach(co => {
                        updateObject(co);
                        set.add(co.id);
                        if (autosubscribe) sub_to_objects.push(co.id);
                    });
                });
                account.settle_orders = account.settle_orders.withMutations(
                    set => {
                        settle_orders.forEach(so => {
                            updateObject(so);
                            set.add(so.id);
                            if (autosubscribe) sub_to_objects.push(so.id);
                        });
                    }
                );
                account.proposals = account.proposals.withMutations(set => {
                    proposals.forEach(p => {
                        updateObject(p);
                        set.add(p.id);
                        if (autosubscribe) sub_to_objects.push(p.id);
                    });
                });

                /*
                 * In order to receive notifications for these objects
                 * we need to manually fetch them with get_objects. This
                 * is only done if autosubscribe is true
                 */
                if (sub_to_objects.length) Apis.db.get_objects(sub_to_objects);

                updateObject(statistics);
                let updated_account = updateObject(account);
                fetchRecentHistory(updated_account);
                notifySubscribers();
            })
            .catch(error => {
                // console.log("get_full_accounts: ", error, error.message === "Assert Exception: account: no such account");
                if (
                    error &&
                    error.message ===
                        "Assert Exception: account: no such account"
                ) {
                    if (is_object_id) {
                        objectById.set(name_or_id, null);
                        notifySubscribers();
                    } else if (is_account_name) {
                        accountsByName.set(name_or_id, null);
                        notifySubscribers();
                    }
                } else {
                    if (is_object_id) objectById.delete(name_or_id);
                    else accountsByName.delete(name_or_id);
                }
            });
    }
    return undefined;
};
