/**
 *  @brief maintains a local cache of blockchain state
 *
 *  The ChainStore maintains a local cache of blockchain state and exposes
 *  an API that makes it easy to query objects and receive updates when
 *  objects are available.
 */
import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import ChainValidation from "../ChainValidation";
import BigInteger from "bigi";
import ee from "../EmitterInstance";
import {
    getObjectType,
    timeStringToDate,
    DEFAULT_AUTO_SUBSCRIBE,
    OP_HISTORY,
    WITNESS_PREFIX,
    COMMITTEE_PREFIX,
    ACCOUNT_PREFIX,
    DEBUG
} from "./utils";

import {
    subscribers,
    clearSubscirbers,
    subscribed,
    chainTimeOffset,
    dispatchFrequency,
    subbed,
    objectById,
    accountsByName,
    assetsBySymbol,
    accountIdsByKey,
    accountIdsByAccount,
    balanceObjectsByAddress,
    getAccountRefsOfKeysCalls,
    getAccountRefsOfAccountsCalls,
    accountHistoryRequests,
    witnessByAccountId,
    workers,
    committeeByAccountId,
    objectsByVoteId,
    fetchingGetFullAccounts,
    getFullAccountsSubscriptions,
    timeout,
    dispatched,
    subError,
    headBlockTimeString,
    clearCache
} from "./store";

let emitter = ee();

clearCache();

const resetCache = subscribe_to_new => {
    subscribed.set(false);
    subError.set(null);
    clearCache();
    headBlockTimeString.set(null);
    return init(subscribe_to_new).catch(err => {
        throw err;
    });
};

const init = (subscribe_to_new = true) =>
    new Promise((resolve, reject) => {
        let reconnectCounter = 0;

        const initSubscribe = () => {
            if (subscribed.get()) return resolve();

            if (!Apis.instance().db_api())
                return reject(
                    "Api not found, please initialize the api instance before calling the ChainStore"
                );

            Apis.db
                .get_objects(["2.1.0"])
                .then(([optionalObject]) => {
                    //let optionalObject = optionalObjects[i];
                    if (!optionalObject) {
                        setTimeout(initSubscribe, 1000);
                        return;
                    }

                    /*
                     ** Because 2.1.0 gets fetched here before the set_subscribe_callback,
                     ** the new witness_node subscription model makes it so we
                     ** never get subscribed to that object, therefore
                     ** _updateObject is commented out here
                     */
                    // _updateObject( optionalObject, true );

                    let head_time = new Date(
                        optionalObject.time + "+00:00"
                    ).getTime();
                    headBlockTimeString.set(optionalObject.time);
                    chainTimeOffset.push(
                        new Date().getTime() -
                            timeStringToDate(optionalObject.time).getTime()
                    );
                    let now = new Date().getTime();

                    if ((now - head_time) / 1000 < 60) {
                        Apis.db
                            .set_subscribe_callback(onUpdate, subscribe_to_new)
                            .then(() => {
                                console.log(
                                    "synced and subscribed, chainstore ready"
                                );
                                subscribed.set(true);
                                subError.set(null);
                                notifySubscribers();
                                resolve();
                            })
                            .catch(error => {
                                subscribed.set(false);
                                subError.set(error);
                                notifySubscribers();
                                console.log("Error: ", error);
                                reject(error);
                            });
                    } else {
                        console.log("not yet synced, retrying in 1s");
                        subscribed.set(false);
                        reconnectCounter++;
                        notifySubscribers();
                        if (reconnectCounter > 5) {
                            subError.set(
                                new Error(
                                    "ChainStore sync error, please check your system clock"
                                )
                            );
                            return reject(subError.get());
                        }
                        setTimeout(initSubscribe, 1000);
                    }
                })
                .catch(error => {
                    // in the event of an error clear the pending state for id
                    console.log("!!! Chain API error", error);
                    objectById.delete("2.1.0");

                    reject(error);
                });
        };

        initSubscribe();
    });

const _subTo = (type, id) => {
    !subbed[type].has(id) && subbed[type].add(id);
};

const unSubFrom = (type, id) => {
    subbed[type].delete(id);
    objectById.delete(id);
};

const _isSubbedTo = (type, id) => subbed[type].has(id);

const onUpdate = (
    updated_objects /// map from account id to objects
) => {
    let cancelledOrders = [];
    let closedCallOrders = [];

    updated_objects.forEach(objects =>
        objects.forEach(obj => {
            if (!ChainValidation.is_object_id(obj)) _updateObject(obj);
            else {
                // An entry containing only an object ID means that object was removed

                // Check if the object exists in the ChainStore
                let old_obj = objectById.get(obj);

                const objectType = getObjectType(obj);

                switch (objectType) {
                    case "limit_order":
                        cancelledOrders.push(obj);
                        if (old_obj) {
                            let account = objectById.get(old_obj.get("seller"));
                            if (account && account.has("orders")) {
                                let limit_orders = account.get("orders");
                                if (account.get("orders").has(obj)) {
                                    account = account.set(
                                        "orders",
                                        limit_orders.delete(obj)
                                    );
                                    objectById.set(account.get("id"), account);
                                }
                            }
                        }
                        break;

                    case "call_order":
                        closedCallOrders.push(obj);
                        if (old_obj) {
                            let account = objectById.get(
                                old_obj.get("borrower")
                            );
                            if (account && account.has("call_orders")) {
                                let call_orders = account.get("call_orders");
                                if (account.get("call_orders").has(obj)) {
                                    account = account.set(
                                        "call_orders",
                                        call_orders.delete(obj)
                                    );
                                    objectById.set(account.get("id"), account);
                                }
                            }
                        }
                        break;

                    case "proposal":
                        subbed.accounts.forEach(acc => {
                            let current = objectById.get(acc);
                            if (current) {
                                let proposals = current.get(
                                    "proposals",
                                    Immutable.Set()
                                );

                                if (proposals.includes(obj)) {
                                    proposals = proposals.delete(obj);
                                    current = current.set(
                                        "proposals",
                                        proposals
                                    );
                                    objectById.set(current.get("id"), current);
                                }
                            }
                        });
                        break;
                }

                // Remove the object (if it already exists), set to null to indicate it does not exist
                if (old_obj) objectById.set(obj, null);
            }
        })
    );

    // Cancelled limit order(s), emit event for any listeners to update their state
    if (cancelledOrders.length) emitter.emit("cancel-order", cancelledOrders);
    // Closed call order, emit event for any listeners to update their state
    if (closedCallOrders.length) emitter.emit("close-call", closedCallOrders);

    // console.log("objects in store count:", objectById.size, updated_objects[0].reduce((final, o) => {
    //     if (o && o.id) {
    //         final.changed.push(o.id);
    //     } else {
    //         final.removed.push(o);
    //     }
    //     return final;
    // }, {changed: [], removed: []}));
    notifySubscribers();
};

const notifySubscribers = () => {
    // Dispatch at most only once every x milliseconds
    if (!dispatched.get()) {
        dispatched.set(true);
        timeout.set(
            setTimeout(() => {
                dispatched.set(false);
                subscribers.forEach(callback => {
                    callback();
                });
            }, dispatchFrequency.get())
        );
    }
};

/**
 *  Add a callback that will be called anytime any object in the cache is updated
 */
const subscribe = callback => {
    if (subscribers.has(callback))
        return console.error("Subscribe callback already exists", callback);
    subscribers.add(callback);
};

/**
 *  Remove a callback that was previously added via subscribe
 */
const unsubscribe = callback => {
    if (!subscribers.has(callback))
        return console.error("Unsubscribe callback does not exists", callback);
    subscribers.delete(callback);
};

/** Clear an object from the cache to force it to be fetched again. This may
 * be useful if a query failed the first time and the wallet has reason to believe
 * it may succeede the second time.
 */
const clearObjectCache = id => {
    objectById.delete(id);
};

/**
 * There are three states an object id could be in:
 *
 * 1. undefined       - returned if a query is pending
 * 3. defined         - return an object
 * 4. null            - query return null
 *
 */
const getObject = (
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

/**
 *  @return undefined if a query is pending
 *  @return null if id_or_symbol has been queired and does not exist
 *  @return object if the id_or_symbol exists
 */
const getAsset = id_or_symbol => {
    if (!id_or_symbol) return null;

    if (ChainValidation.is_object_id(id_or_symbol)) {
        let asset = getObject(id_or_symbol);

        if (
            asset &&
            (asset.get("bitasset") &&
                !asset.getIn(["bitasset", "current_feed"]))
        ) {
            return undefined;
        }
        return asset;
    }

    /// TODO: verify id_or_symbol is a valid symbol name

    let asset_id = assetsBySymbol.get(id_or_symbol);

    if (ChainValidation.is_object_id(asset_id)) {
        let asset = getObject(asset_id);

        if (
            asset &&
            (asset.get("bitasset") &&
                !asset.getIn(["bitasset", "current_feed"]))
        ) {
            return undefined;
        }
        return asset;
    }

    if (asset_id === null) return null;

    if (asset_id === true) return undefined;

    Apis.db
        .lookup_asset_symbols([id_or_symbol])
        .then(asset_objects => {
            if (asset_objects.length && asset_objects[0])
                _updateObject(asset_objects[0], true);
            else {
                assetsBySymbol.set(id_or_symbol, null);
                notifySubscribers();
            }
        })
        .catch(error => {
            console.log("Error: ", error);
            assetsBySymbol.delete(id_or_symbol);
        });

    return undefined;
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
const getAccountRefsOfKey = key => {
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
const getAccountRefsOfAccount = account_id => {
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
    return undefined;
};

/**
 * @return a Set of balance ids that are claimable with the given address
 * @return undefined if a query is pending and the set is not known at this time
 * @return a empty Set if no items are found
 *
 * If this method returns undefined, then it will send a request to the server for
 * the current state after which it will be subscribed to changes to this set.
 */
const getBalanceObjects = address => {
    let current = balanceObjectsByAddress.get(address);
    if (current === undefined) {
        /** because balance objects are simply part of the genesis state, there is no need to worry about
         * having to update them / merge them or index them in updateObject.
         */
        balanceObjectsByAddress.set(address, Immutable.Set());
        Apis.db.get_balance_objects([address]).then(
            balance_objects => {
                let set = new Set();
                for (let i = 0; i < balance_objects.length; ++i) {
                    _updateObject(balance_objects[i]);
                    set.add(balance_objects[i].id);
                }
                balanceObjectsByAddress.set(address, Immutable.Set(set));
                notifySubscribers();
            },
            () => {
                balanceObjectsByAddress.delete(address);
            }
        );
    }
    return balanceObjectsByAddress.get(address);
};

/**
 *  If there is not already a pending request to fetch this object, a new
 *  request will be made.
 *
 *  @return null if the object does not exist,
 *  @return undefined if the object might exist but is not in cache
 *  @return the object if it does exist and is in our cache
 */
const fetchObject = (
    id,
    force = false,
    autosubscribe = null,
    no_full_account = false
) => {
    if (autosubscribe == null) {
        autosubscribe = DEFAULT_AUTO_SUBSCRIBE;
    }
    if (typeof id !== "string") {
        let result = [];
        for (let i = 0; i < id.length; ++i)
            result.push(fetchObject(id[i], force, autosubscribe));
        return result;
    }

    if (DEBUG)
        console.log(
            "!!! fetchObject: ",
            id,
            subscribed.get(),
            !subscribed.get() && !force
        );
    if (!subscribed.get() && !force) return undefined;

    if (DEBUG) console.log("maybe fetch object: ", id);
    if (!ChainValidation.is_object_id(id))
        throw Error("argument is not an object id: " + id);

    if (id.search("1.2.") === 0 && !no_full_account)
        return fetchFullAccount(id, autosubscribe);
    if (id.search(WITNESS_PREFIX) === 0) _subTo("witnesses", id);
    if (id.search(COMMITTEE_PREFIX) === 0) _subTo("committee", id);

    let result = objectById.get(id);
    if (result === undefined) {
        // the fetch
        if (DEBUG) console.log("fetching object: ", id);
        objectById.set(id, true);
        if (!Apis.instance().db_api()) return null;
        Apis.db
            .get_objects([id])
            .then(optional_objects => {
                //if(DEBUG) console.log("... optional_objects",optional_objects ? optional_objects[0].id : null)
                for (let i = 0; i < optional_objects.length; i++) {
                    let optional_object = optional_objects[i];
                    if (optional_object) {
                        _updateObject(optional_object, true);
                    } else {
                        objectById.set(id, null);
                        notifySubscribers();
                    }
                }
            })
            .catch(error => {
                // in the event of an error clear the pending state for id
                console.log("!!! Chain API error", error);
                objectById.delete(id);
            });
    } else if (result === true)
        // then we are waiting a response
        return undefined;
    return result; // we have a response, return it
};

/**
 *  @return null if no such account exists
 *  @return undefined if such an account may exist, and fetch the the full account if not already pending
 *  @return the account object if it does exist
 */
const getAccount = (name_or_id, autosubscribe = null) => {
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

/**
 *  @return undefined if the account name is not yet cached, and fetch the the full account if not already pending
 *  @return null if the account name or id are unvalid, or the account does not exist
 *  @return the account name
 */
const getAccountName = id => {
    let account = objectById.get(id);
    if (account === true) return undefined;
    if (!account) {
        getObject(id, false, false, true);
        return undefined;
    }
    return account.get("name");
};

/**
 * This method will attempt to lookup witness by account_id.
 * If witness doesn't exist it will return null, if witness is found it will return witness object,
 * if it's not fetched yets it will return undefined.
 * @param account_id - account id
 */
const getWitnessById = account_id => {
    let witness_id = witnessByAccountId.get(account_id);
    if (witness_id === undefined) {
        fetchWitnessByAccount(account_id);
        return undefined;
    } else if (witness_id) {
        _subTo("witnesses", witness_id);
    }

    return witness_id ? getObject(witness_id) : null;
};

/**
 * This method will attempt to lookup committee member by account_id.
 * If committee member doesn't exist it will return null, if committee member is found it will return committee member object,
 * if it's not fetched yet it will return undefined.
 * @param account_id - account id
 */
const getCommitteeMemberById = account_id => {
    let cm_id = committeeByAccountId.get(account_id);
    if (cm_id === undefined) {
        fetchCommitteeMemberByAccount(account_id);
        return undefined;
    } else if (cm_id) {
        _subTo("committee", cm_id);
    }
    return cm_id ? getObject(cm_id) : null;
};

/**
 *
 * @return a promise with the workers array
 */
const fetchAllWorkers = () => {
    return new Promise((resolve, reject) => {
        Apis.db.get_all_workers().then(workers_array => {
            if (workers_array && workers_array.length) {
                workers_array.forEach(worker => {
                    _updateObject(worker, false);
                });
                resolve(workers_array);
                notifySubscribers();
            } else {
                resolve([]);
            }
        }, reject);
    });
};

/**
 *
 * @return a promise with the witness object
 */
const fetchWitnessByAccount = account_id => {
    return new Promise((resolve, reject) => {
        Apis.db
            .get_witness_by_account(account_id)
            .then(optional_witness_object => {
                if (optional_witness_object) {
                    _subTo("witnesses", optional_witness_object.id);
                    witnessByAccountId.set(
                        optional_witness_object.witness_account,
                        optional_witness_object.id
                    );
                    let witness_object = _updateObject(
                        optional_witness_object,
                        true
                    );
                    resolve(witness_object);
                } else {
                    witnessByAccountId.set(account_id, null);
                    notifySubscribers();
                    resolve(null);
                }
            }, reject);
    });
};
/**
 *
 * @return a promise with the witness object
 */
const fetchCommitteeMemberByAccount = account_id => {
    return new Promise((resolve, reject) => {
        Apis.db
            .get_committee_member_by_account(account_id)
            .then(optional_committee_object => {
                if (optional_committee_object) {
                    _subTo("committee", optional_committee_object.id);
                    committeeByAccountId.set(
                        optional_committee_object.committee_member_account,
                        optional_committee_object.id
                    );
                    let committee_object = _updateObject(
                        optional_committee_object,
                        true
                    );
                    resolve(committee_object);
                } else {
                    committeeByAccountId.set(account_id, null);
                    notifySubscribers();
                    resolve(null);
                }
            }, reject);
    });
};

/**
 *  Fetches an account and all of its associated data in a single query
 *
 *  @param an account name or account id
 *
 *  @return undefined if the account in question is in the process of being fetched
 *  @return the object if it has already been fetched
 *  @return null if the object has been queried and was not found
 */
const fetchFullAccount = (name_or_id, autosubscribe = null) => {
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
                            _updateObject(vb);
                            set.add(vb.id);
                        });
                    }
                );

                let sub_to_objects = [];

                votes.forEach(v => _updateObject(v));

                account.balances = account.balances.withMutations(map => {
                    full_account.balances.forEach(b => {
                        _updateObject(b);
                        map.set(b.asset_type, b.id);
                        if (autosubscribe) sub_to_objects.push(b.id);
                    });
                });
                account.orders = account.orders.withMutations(set => {
                    limit_orders.forEach(order => {
                        _updateObject(order);
                        set.add(order.id);
                        if (autosubscribe) sub_to_objects.push(order.id);
                    });
                });
                account.call_orders = account.call_orders.withMutations(set => {
                    call_orders.forEach(co => {
                        _updateObject(co);
                        set.add(co.id);
                        if (autosubscribe) sub_to_objects.push(co.id);
                    });
                });
                account.settle_orders = account.settle_orders.withMutations(
                    set => {
                        settle_orders.forEach(so => {
                            _updateObject(so);
                            set.add(so.id);
                            if (autosubscribe) sub_to_objects.push(so.id);
                        });
                    }
                );
                account.proposals = account.proposals.withMutations(set => {
                    proposals.forEach(p => {
                        _updateObject(p);
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

                _updateObject(statistics);
                let updated_account = _updateObject(account);
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

const getAccountMemberStatus = account => {
    if (account === undefined) return undefined;
    if (account === null) return "unknown";
    if (account.get("lifetime_referrer") == account.get("id"))
        return "lifetime";
    let exp = new Date(account.get("membership_expiration_date")).getTime();
    let now = new Date().getTime();
    if (exp < now) return "basic";
    return "annual";
};

const getAccountBalance = (account, asset_type) => {
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
 * There are two ways to extend the account history, add new more
 * recent history, and extend historic hstory. This method will fetch
 * the most recent account history and prepend it to the list of
 * historic operations.
 *
 *  @param account immutable account object
 *  @return a promise with the account history
 */
const fetchRecentHistory = (account, limit = 100) => {
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

/**
 *  Updates the object in place by only merging the set
 *  properties of object.
 *
 *  This method will create an immutable object with the given ID if
 *  it does not already exist.
 *
 *  This is a "private" method called when data is received from the
 *  server and should not be used by others.
 *
 *  @pre object.id must be a valid object ID
 *  @return an Immutable constructed from object and deep merged with the current state
 */
const _updateObject = (object, notify_subscribers = false, emit = true) => {
    if (!("id" in object)) {
        console.log("object with no id:", object);
        /* Settle order updates look different and need special handling */
        if (
            "balance" in object &&
            "owner" in object &&
            "settlement_date" in object
        ) {
            // Settle order object
            emitter.emit("settle-order-update", object);
        }
        return;
    }

    const objectType = getObjectType(object.id);

    /*
     * A lot of objects get spammed by the API that we don't care about, filter these out here
     */
    // Transaction object

    switch (objectType) {
        case "transaction":
        case "operation_history":
        case "block_summary":
            return; // console.log("not interested in:", objectType, object);
            break;

        case "account_transaction_history":
        case "limit_order":
        case "call_order":
        case "account_balance":
        case "account_stats":
            if (
                !_isSubbedTo(
                    "accounts",
                    object.account ||
                        object.seller ||
                        object.borrower ||
                        object.owner
                )
            ) {
                return; // console.log("not interested in", objectType, object.account || object.seller || object.borrower || object.owner);
            }
            break;

        case "witness":
            if (!_isSubbedTo("witnesses", object.id)) {
                return;
            }
            break;

        case "committee_member":
            if (!_isSubbedTo("committee", object.id)) {
                return;
            }
            break;

        case "unknown":
        case "market":
            return;
            break;

        default:
    }

    // DYNAMIC GLOBAL OBJECT
    if (object.id == "2.1.0") {
        object.participation =
            100 * (BigInteger(object.recent_slots_filled).bitCount() / 128.0);
        headBlockTimeString.set(object.time);
        chainTimeOffset.push(
            Date.now() - timeStringToDate(object.time).getTime()
        );
        if (chainTimeOffset.length > 10) chainTimeOffset.shift(); // remove first
    }

    let current = objectById.get(object.id);
    if (!current) {
        // console.log("add object:", object.id);
        current = Immutable.Map();
    }
    let prior = current;

    /* New object */
    if (current === undefined || current === true)
        objectById.set(object.id, (current = Immutable.fromJS(object)));
    else {
        /* Existing object */ switch (objectType) {
            /*
             * These cases have additional data attached inside the chainstore,
             * so we need to use mergeDeep to keep that data
             */
            case "account":
            case "asset":
            case "asset_bitasset_data":
                objectById.set(
                    object.id,
                    (current = current.mergeDeep(Immutable.fromJS(object)))
                );
                break;

            /* Don't use merge deep to improve performance */
            default:
                objectById.set(object.id, (current = Immutable.fromJS(object)));
        }
    }

    /* Special handling for various objects */

    // BALANCE OBJECT

    switch (objectType) {
        case "account_balance":
            let owner = objectById.get(object.owner);
            if (owner === undefined || owner === null || owner === true) {
                return;
            } else {
                let balances = owner.get("balances");
                if (!balances) owner = owner.set("balances", Immutable.Map());
                owner = owner.setIn(["balances", object.asset_type], object.id);
            }
            objectById.set(object.owner, owner);
            break;

        case "account_statistics":
            try {
                let prior_most_recent_op = prior.get("most_recent_op", "2.9.0");

                if (prior_most_recent_op != object.most_recent_op) {
                    fetchRecentHistory(object.owner);
                }
            } catch (err) {
                console.log("object:", object, "prior", prior, "err:", err);
            }
            break;

        case "witness":
            if (_isSubbedTo("witnesses", object.id)) {
                witnessByAccountId.set(object.witness_account, object.id);
                objectsByVoteId.set(object.vote_id, object.id);
            } else {
                return;
            }
            break;

        case "committee_member":
            if (_isSubbedTo("committee", object.id)) {
                committeeByAccountId.set(
                    object.committee_member_account,
                    object.id
                );
                objectsByVoteId.set(object.vote_id, object.id);
            } else {
                return;
            }
            break;

        case "worker":
            objectsByVoteId.set(object.vote_for, object.id);
            objectsByVoteId.set(object.vote_against, object.id);

            if (!workers.has(object.id)) workers.add(object.id);
            break;

        case "account":
            current = current.set("active", Immutable.fromJS(object.active));
            current = current.set("owner", Immutable.fromJS(object.owner));
            current = current.set("options", Immutable.fromJS(object.options));
            current = current.set(
                "whitelisting_accounts",
                Immutable.fromJS(object.whitelisting_accounts)
            );
            current = current.set(
                "blacklisting_accounts",
                Immutable.fromJS(object.blacklisting_accounts)
            );
            current = current.set(
                "whitelisted_accounts",
                Immutable.fromJS(object.whitelisted_accounts)
            );
            current = current.set(
                "blacklisted_accounts",
                Immutable.fromJS(object.blacklisted_accounts)
            );
            objectById.set(object.id, current);
            accountsByName.set(object.name, object.id);

            break;

        case "asset":
            assetsBySymbol.set(object.symbol, object.id);

            // make sure we fetch the bitasset data object
            let bitasset = current.get("bitasset");
            if (!bitasset && "bitasset_data_id" in object) {
                let bad = getObject(object.bitasset_data_id, true);
                if (!bad) bad = Immutable.Map();

                if (!bad.get("asset_id")) {
                    bad = bad.set("asset_id", object.id);
                }
                objectById.set(object.bitasset_data_id, bad);

                current = current.set("bitasset", bad);
                objectById.set(object.id, current);
            }
            break;

        case "asset_bitasset_data":
            let asset_id = current.get("asset_id");
            if (asset_id) {
                let asset = getObject(asset_id);
                if (asset) {
                    asset = asset.set("bitasset", current);
                    emitter.emit("bitasset-update", asset);
                    objectById.set(asset_id, asset);
                }
            }
            break;

        case "call_order":
            if (emit) {
                emitter.emit("call-order-update", object);
            }

            let call_account = objectById.get(object.borrower);
            if (call_account && call_account !== true) {
                if (!call_account.has("call_orders"))
                    call_account = call_account.set(
                        "call_orders",
                        new Immutable.Set()
                    );
                let call_orders = call_account.get("call_orders");
                if (!call_orders.has(object.id)) {
                    call_account = call_account.set(
                        "call_orders",
                        call_orders.add(object.id)
                    );
                    objectById.set(call_account.get("id"), call_account);
                    Apis.db.get_objects([object.id]); // Force subscription to the object in the witness node by calling get_objects
                }
            }
            break;

        case "limit_order":
            let limit_account = objectById.get(object.seller);
            if (limit_account && limit_account !== true) {
                if (!limit_account.has("orders"))
                    limit_account = limit_account.set(
                        "orders",
                        new Immutable.Set()
                    );
                let limit_orders = limit_account.get("orders");
                if (!limit_orders.has(object.id)) {
                    limit_account = limit_account.set(
                        "orders",
                        limit_orders.add(object.id)
                    );
                    objectById.set(limit_account.get("id"), limit_account);
                    Apis.db.get_objects([object.id]); // Force subscription to the object in the witness node by calling get_objects
                }
            }
            break;

        case "proposal":
            /*
             * Make sure notify_subscribers is set to true if a proposal is
             * added to an account
             */
            notify_subscribers =
                notify_subscribers ||
                addProposalData(object.required_active_approvals, object.id);
            notify_subscribers =
                notify_subscribers ||
                addProposalData(object.required_owner_approvals, object.id);
            break;

        default:
    }

    if (notify_subscribers) {
        notifySubscribers();
    }
    return current;
};

const getObjectsByVoteIds = vote_ids => {
    let result = [];
    let missing = [];
    for (let i = 0; i < vote_ids.length; ++i) {
        let obj = objectsByVoteId.get(vote_ids[i]);
        if (obj) result.push(getObject(obj));
        else {
            result.push(null);
            missing.push(vote_ids[i]);
        }
    }

    if (missing.length) {
        // we may need to fetch some objects
        Apis.db
            .lookup_vote_ids(missing)
            .then(vote_obj_array => {
                // console.log("missing ===========> ", missing);
                // console.log(
                //     "vote objects ===========> ",
                //     vote_obj_array
                // );
                for (let i = 0; i < vote_obj_array.length; ++i) {
                    if (vote_obj_array[i]) {
                        let isWitness =
                            vote_obj_array[i].id.substring(
                                0,
                                WITNESS_PREFIX.length
                            ) == WITNESS_PREFIX;
                        _subTo(
                            isWitness ? "witnesses" : "committee",
                            vote_obj_array[i].id
                        );
                        _updateObject(vote_obj_array[i]);
                    }
                }
            })
            .catch(error => {
                console.log("Error looking up vote ids: ", error);
            });
    }
    return result;
};

const getObjectByVoteID = vote_id => {
    let obj_id = objectsByVoteId.get(vote_id);
    if (obj_id) return getObject(obj_id);
    return undefined;
};

const getHeadBlockDate = () => {
    return timeStringToDate(headBlockTimeString.get());
};

const getEstimatedChainTimeOffset = () => {
    if (chainTimeOffset.length === 0) return 0;
    // Immutable is fast, sorts numbers correctly, and leaves the original unmodified
    // This will fix itself if the user changes their clock
    var median_offset = Immutable.List(chainTimeOffset)
        .sort()
        .get(Math.floor((chainTimeOffset.length - 1) / 2));
    // console.log("median_offset", median_offset)
    return median_offset;
};

const addProposalData = (approvals, objectId) => {
    let didImpact = false;
    approvals.forEach(id => {
        let impactedAccount = objectById.get(id);
        if (impactedAccount && impactedAccount !== true) {
            didImpact = true;
            let proposals = impactedAccount.get("proposals", Immutable.Set());

            if (!proposals.includes(objectId)) {
                proposals = proposals.add(objectId);
                impactedAccount = impactedAccount.set("proposals", proposals);
                objectById.set(impactedAccount.get("id"), impactedAccount);
            }
        }
    });
    return didImpact;
};

function FetchChainObjects(method, object_ids, timeout, subMap) {
    let get_object = method.bind(chain_store);

    return new Promise((resolve, reject) => {
        let timeout_handle = null;

        function onUpdate(not_subscribed_yet = false) {
            let res = object_ids.map(id => {
                if (method.name === "getAccount")
                    return get_object(id, subMap[id]);
                if (method.name === "getObject")
                    return get_object(id, false, subMap[id]);
                return get_object(id);
            });
            if (res.findIndex(o => o === undefined) === -1) {
                if (timeout_handle) clearTimeout(timeout_handle);
                if (!not_subscribed_yet) chain_store.unsubscribe(onUpdate);
                resolve(res);
                return true;
            }
            return false;
        }

        let resolved = onUpdate(true);
        if (!resolved) chain_store.subscribe(onUpdate);

        if (timeout && !resolved)
            timeout_handle = setTimeout(() => {
                chain_store.unsubscribe(onUpdate);
                reject(
                    `${
                        method.name
                    } request timed out after ${timeout}ms with object ids: ${JSON.stringify(
                        object_ids
                    )}`
                );
            }, timeout);
    });
}

function FetchChain(methodName, objectIds, timeout = 3000, subMap = {}) {
    let method = chain_store[methodName];
    if (!method)
        throw new Error("ChainStore does not have method " + methodName);

    let arrayIn = Array.isArray(objectIds);
    if (!arrayIn) objectIds = [objectIds];

    return chain_store
        .FetchChainObjects(method, Immutable.List(objectIds), timeout, subMap)
        .then(res => (arrayIn ? res : res.get(0)));
}

const chain_store = {
    clearSubscirbers,
    clearCache,
    resetCache,
    setDispatchFrequency: dispatchFrequency.set,
    init,
    _subTo,
    unSubFrom,
    _isSubbedTo,
    onUpdate,
    notifySubscribers,
    subscribe,
    unsubscribe,
    clearObjectCache,
    getObject,
    getAsset,
    getAccountRefsOfKey,
    getAccountRefsOfAccount,
    getBalanceObjects,
    fetchObject,
    getAccount,
    getAccountName,
    getWitnessById,
    getCommitteeMemberById,
    fetchAllWorkers,
    fetchWitnessByAccount,
    fetchCommitteeMemberByAccount,
    fetchFullAccount,
    getAccountMemberStatus,
    getAccountBalance,
    fetchRecentHistory,
    _updateObject,
    getObjectsByVoteIds,
    getObjectByVoteID,
    getHeadBlockDate,
    getEstimatedChainTimeOffset,
    addProposalData,
    FetchChain,
    FetchChainObjects
};

export default chain_store;
