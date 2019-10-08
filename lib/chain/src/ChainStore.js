import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import ChainTypes from "./ChainTypes";
import ChainValidation from "./ChainValidation";
import BigInteger from "bigi";
import ee from "./EmitterInstance";
const {object_type, impl_object_type} = ChainTypes;
let emitter = ee();

let op_history = parseInt(object_type.operation_history, 10);
let witness_object_type = parseInt(object_type.witness, 10);
let committee_member_object_type = parseInt(object_type.committee_member, 10);
let account_object_type = parseInt(object_type.account, 10);
let witness_prefix = "1." + witness_object_type + ".";
let committee_prefix = "1." + committee_member_object_type + ".";
let account_prefix = "1." + account_object_type + ".";

const DEBUG = JSON.parse(
    process.env.npm_config__graphene_chain_chain_debug || false
);

const objectTypesArray = Object.keys(object_type);
const implObjectTypesArray = Object.keys(impl_object_type);

let default_auto_subscribe = true;

function getObjectType(id) {
    let [one, two] = id.split(".");
    two = parseInt(two, 10);
    switch (one) {
        case "0":
            return "unknown";
        case "1":
            return objectTypesArray[two];
        case "2":
            return implObjectTypesArray[two];
        case "5":
            return "market";
        default:
    }
}

/**
 *  @brief maintains a local cache of blockchain state
 *
 *  The ChainStore maintains a local cache of blockchain state and exposes
 *  an API that makes it easy to query objects and receive updates when
 *  objects are available.
 */
class ChainStore {
    constructor() {
        /** tracks everyone who wants to receive updates when the cache changes */
        this.subscribers = new Set();
        this.subscribed = false;

        this.clearCache();
        // this.progress = 0;
        // this.chain_time_offset is used to estimate the blockchain time
        this.chain_time_offset = [];
        this.dispatchFrequency = 40;
    }

    /**
     * Clears all cached state.  This should be called any time the network connection is
     * reset.
     */
    clearCache() {
        /*
        * Tracks specific objects such as accounts that can trigger additional
        * fetching that should only happen if we're actually interested in the account
        */
        this.subbed_accounts = new Set();
        this.subbed_witnesses = new Set();
        this.subbed_committee = new Set();

        this.objects_by_id = new Map();
        this.accounts_by_name = new Map();
        this.assets_by_symbol = new Map();
        this.account_ids_by_key = Immutable.Map();
        this.account_ids_by_account = Immutable.Map();

        this.balance_objects_by_address = new Map();
        this.get_account_refs_of_keys_calls = new Set();
        this.get_account_refs_of_accounts_calls = new Set();
        this.account_history_requests = new Map(); ///< tracks pending history requests
        this.witness_by_account_id = new Map();
        this.workers = new Set();
        this.committee_by_account_id = new Map();
        this.objects_by_vote_id = new Map();
        this.fetching_get_full_accounts = new Map();
        this.get_full_accounts_subscriptions = new Map();
        clearTimeout(this.timeout);
        this.dispatched = false;
    }

    resetCache(subscribe_to_new) {
        this.subscribed = false;
        this.subError = null;
        this.clearCache();
        this.head_block_time_string = null;
        return this.init(subscribe_to_new).catch(err => {
            throw err;
        });
    }

    setDispatchFrequency(freq) {
        this.dispatchFrequency = freq;
    }

    init(subscribe_to_new = true) {
        let reconnectCounter = 0;
        var _init = (resolve, reject) => {
            if (this.subscribed) return resolve();
            let db_api = Apis.instance().db_api();
            if (!db_api) {
                return reject(
                    new Error(
                        "Api not found, please initialize the api instance before calling the ChainStore"
                    )
                );
            }
            return db_api
                .exec("get_objects", [["2.1.0"]])
                .then(optional_objects => {
                    //if(DEBUG) console.log("... optional_objects",optional_objects ? optional_objects[0].id : null)
                    for (let i = 0; i < optional_objects.length; i++) {
                        let optional_object = optional_objects[i];
                        if (optional_object) {
                            /*
                        ** Because 2.1.0 gets fetched here before the set_subscribe_callback,
                        ** the new witness_node subscription model makes it so we
                        ** never get subscribed to that object, therefore
                        ** this._updateObject is commented out here
                        */
                            // this._updateObject( optional_object, true );

                            let head_time = new Date(
                                optional_object.time + "+00:00"
                            ).getTime();
                            this.head_block_time_string = optional_object.time;
                            this.chain_time_offset.push(
                                new Date().getTime() -
                                    timeStringToDate(
                                        optional_object.time
                                    ).getTime()
                            );
                            let now = new Date().getTime();
                            let delta = (now - head_time) / 1000;
                            // let start = Date.parse("Sep 1, 2015");
                            // let progress_delta = head_time - start;
                            // this.progress = progress_delta / (now-start);

                            if (delta < 60) {
                                Apis.instance()
                                    .db_api()
                                    .exec("set_subscribe_callback", [
                                        this.onUpdate.bind(this),
                                        subscribe_to_new
                                    ])
                                    .then(() => {
                                        console.log(
                                            "synced and subscribed, chainstore ready"
                                        );
                                        this.subscribed = true;
                                        this.subError = null;
                                        this.notifySubscribers();
                                        resolve();
                                    })
                                    .catch(error => {
                                        this.subscribed = false;
                                        this.subError = error;
                                        this.notifySubscribers();
                                        reject(error);
                                        console.log("Error: ", error);
                                    });
                            } else {
                                console.log("not yet synced, retrying in 1s");
                                this.subscribed = false;
                                reconnectCounter++;
                                this.notifySubscribers();
                                if (reconnectCounter > 5) {
                                    this.subError = new Error(
                                        "ChainStore sync error, please check your system clock"
                                    );
                                    return reject(this.subError);
                                }
                                setTimeout(
                                    _init.bind(this, resolve, reject),
                                    1000
                                );
                            }
                        } else {
                            setTimeout(_init.bind(this, resolve, reject), 1000);
                        }
                    }
                })
                .catch(error => {
                    // in the event of an error clear the pending state for id
                    console.log("!!! Chain API error", error);
                    this.objects_by_id.delete("2.1.0");
                    reject(error);
                });
        };

        return new Promise((resolve, reject) => _init(resolve, reject));
    }

    _subTo(type, id) {
        let key = "subbed_" + type;
        if (!this[key].has(id)) this[key].add(id);
    }

    unSubFrom(type, id) {
        let key = "subbed_" + type;
        this[key].delete(id);
        this.objects_by_id.delete(id);
    }

    _isSubbedTo(type, id) {
        let key = "subbed_" + type;
        return this[key].has(id);
    }

    onUpdate(
        updated_objects /// map from account id to objects
    ) {
        let cancelledOrders = [];
        let closedCallOrders = [];

        for (let a = 0; a < updated_objects.length; ++a) {
            for (let i = 0; i < updated_objects[a].length; ++i) {
                let obj = updated_objects[a][i];
                if (ChainValidation.is_object_id(obj)) {
                    // An entry containing only an object ID means that object was removed

                    // Check if the object exists in the ChainStore
                    let old_obj = this.objects_by_id.get(obj);

                    const objectType = getObjectType(obj);

                    switch (objectType) {
                        case "limit_order":
                            cancelledOrders.push(obj);
                            if (old_obj) {
                                let account = this.objects_by_id.get(
                                    old_obj.get("seller")
                                );
                                if (account && account.has("orders")) {
                                    let limit_orders = account.get("orders");
                                    if (account.get("orders").has(obj)) {
                                        account = account.set(
                                            "orders",
                                            limit_orders.delete(obj)
                                        );
                                        this.objects_by_id.set(
                                            account.get("id"),
                                            account
                                        );
                                    }
                                }
                            }
                            break;

                        case "call_order":
                            closedCallOrders.push(obj);
                            if (old_obj) {
                                let account = this.objects_by_id.get(
                                    old_obj.get("borrower")
                                );
                                if (account && account.has("call_orders")) {
                                    let call_orders = account.get(
                                        "call_orders"
                                    );
                                    if (account.get("call_orders").has(obj)) {
                                        account = account.set(
                                            "call_orders",
                                            call_orders.delete(obj)
                                        );
                                        this.objects_by_id.set(
                                            account.get("id"),
                                            account
                                        );
                                    }
                                }
                            }
                            break;

                        case "proposal":
                            this.subbed_accounts.forEach(acc => {
                                let current = this.objects_by_id.get(acc);
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
                                        this.objects_by_id.set(
                                            current.get("id"),
                                            current
                                        );
                                    }
                                }
                            });
                            break;
                    }

                    // Remove the object (if it already exists), set to null to indicate it does not exist
                    if (old_obj) this.objects_by_id.set(obj, null);
                } else {
                    this._updateObject(obj);
                }
            }
        }

        // Cancelled limit order(s), emit event for any listeners to update their state
        if (cancelledOrders.length)
            emitter.emit("cancel-order", cancelledOrders);
        // Closed call order, emit event for any listeners to update their state
        if (closedCallOrders.length)
            emitter.emit("close-call", closedCallOrders);

        // console.log("objects in store count:", this.objects_by_id.size, updated_objects[0].reduce((final, o) => {
        //     if (o && o.id) {
        //         final.changed.push(o.id);
        //     } else {
        //         final.removed.push(o);
        //     }
        //     return final;
        // }, {changed: [], removed: []}));
        this.notifySubscribers();
    }

    notifySubscribers() {
        // Dispatch at most only once every x milliseconds
        if (!this.dispatched) {
            this.dispatched = true;
            this.timeout = setTimeout(() => {
                this.dispatched = false;
                this.subscribers.forEach(callback => {
                    callback();
                });
            }, this.dispatchFrequency);
        }
    }

    /**
     *  Add a callback that will be called anytime any object in the cache is updated
     */
    subscribe(callback) {
        if (this.subscribers.has(callback))
            return console.error("Subscribe callback already exists", callback);
        this.subscribers.add(callback);
    }

    /**
     *  Remove a callback that was previously added via subscribe
     */
    unsubscribe(callback) {
        if (!this.subscribers.has(callback))
            return console.error(
                "Unsubscribe callback does not exists",
                callback
            );
        this.subscribers.delete(callback);
    }

    /** Clear an object from the cache to force it to be fetched again. This may
     * be useful if a query failed the first time and the wallet has reason to believe
     * it may succeede the second time.
     */
    clearObjectCache(id) {
        this.objects_by_id.delete(id);
    }

    /**
     * There are three states an object id could be in:
     *
     * 1. undefined       - returned if a query is pending
     * 3. defined         - return an object
     * 4. null            - query return null
     *
     */
    getObject(
        id,
        force = false,
        autosubscribe = null,
        no_full_account = false
    ) {
        if (autosubscribe == null) {
            autosubscribe = default_auto_subscribe;
        }
        if (!ChainValidation.is_object_id(id))
            throw Error("argument is not an object id: " + JSON.stringify(id));

        let result = this.objects_by_id.get(id);
        let subChange =
            id.substring(0, account_prefix.length) == account_prefix &&
            !this.get_full_accounts_subscriptions.get(id, false) &&
            autosubscribe;

        if (result === null && !force) return result;
        if (result === undefined || force || subChange)
            return this.fetchObject(id, force, autosubscribe, no_full_account);
        if (result === true) return undefined;

        return result;
    }

    /**
     *  @return undefined if a query is pending
     *  @return null if id_or_symbol has been queired and does not exist
     *  @return object if the id_or_symbol exists
     */
    getAsset(id_or_symbol) {
        if (!id_or_symbol) return null;

        if (ChainValidation.is_object_id(id_or_symbol)) {
            let asset = this.getObject(id_or_symbol);

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

        let asset_id = this.assets_by_symbol.get(id_or_symbol);

        if (ChainValidation.is_object_id(asset_id)) {
            let asset = this.getObject(asset_id);

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

        Apis.instance()
            .db_api()
            .exec("lookup_asset_symbols", [[id_or_symbol]])
            .then(asset_objects => {
                if (asset_objects.length && asset_objects[0])
                    this._updateObject(asset_objects[0], true);
                else {
                    this.assets_by_symbol.set(id_or_symbol, null);
                    this.notifySubscribers();
                }
            })
            .catch(error => {
                console.log("Error: ", error);
                this.assets_by_symbol.delete(id_or_symbol);
            });

        return undefined;
    }

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
    getAccountRefsOfKey(key) {
        if (this.get_account_refs_of_keys_calls.has(key))
            return this.account_ids_by_key.get(key);
        else {
            this.get_account_refs_of_keys_calls.add(key);

            Apis.instance()
                .db_api()
                .exec("get_key_references", [[key]])
                .then(vec_account_id => {
                    let refs = Immutable.Set();
                    vec_account_id = vec_account_id[0];
                    refs = refs.withMutations(r => {
                        for (let i = 0; i < vec_account_id.length; ++i) {
                            r.add(vec_account_id[i]);
                        }
                    });
                    this.account_ids_by_key = this.account_ids_by_key.set(
                        key,
                        refs
                    );
                    this.notifySubscribers();
                })
                .catch(err => {
                    console.error("get_key_references", err);
                    this.account_ids_by_key = this.account_ids_by_key.delete(
                        key
                    );
                    this.get_account_refs_of_keys_calls.delete(key);
                });
            return undefined;
        }
        return undefined;
    }

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
    getAccountRefsOfAccount(account_id) {
        if (this.get_account_refs_of_accounts_calls.has(account_id))
            return this.account_ids_by_account.get(account_id);
        else {
            this.get_account_refs_of_accounts_calls.add(account_id);

            Apis.instance()
                .db_api()
                .exec("get_account_references", [account_id])
                .then(vec_account_id => {
                    let refs = Immutable.Set();
                    refs = refs.withMutations(r => {
                        for (let i = 0; i < vec_account_id.length; ++i) {
                            r.add(vec_account_id[i]);
                        }
                    });
                    this.account_ids_by_account = this.account_ids_by_account.set(
                        account_id,
                        refs
                    );
                    this.notifySubscribers();
                })
                .catch(err => {
                    console.error("get_account_references", err);
                    this.account_ids_by_account = this.account_ids_by_account.delete(
                        account_id
                    );
                    this.get_account_refs_of_accounts_calls.delete(account_id);
                });
            return undefined;
        }
        return undefined;
    }

    /**
     * @return a Set of balance ids that are claimable with the given address
     * @return undefined if a query is pending and the set is not known at this time
     * @return a empty Set if no items are found
     *
     * If this method returns undefined, then it will send a request to the server for
     * the current state after which it will be subscribed to changes to this set.
     */
    getBalanceObjects(address) {
        let current = this.balance_objects_by_address.get(address);
        if (current === undefined) {
            /** because balance objects are simply part of the genesis state, there is no need to worry about
             * having to update them / merge them or index them in updateObject.
             */
            this.balance_objects_by_address.set(address, Immutable.Set());
            Apis.instance()
                .db_api()
                .exec("get_balance_objects", [[address]])
                .then(
                    balance_objects => {
                        let set = new Set();
                        for (let i = 0; i < balance_objects.length; ++i) {
                            this._updateObject(balance_objects[i]);
                            set.add(balance_objects[i].id);
                        }
                        this.balance_objects_by_address.set(
                            address,
                            Immutable.Set(set)
                        );
                        this.notifySubscribers();
                    },
                    () => {
                        this.balance_objects_by_address.delete(address);
                    }
                );
        }
        return this.balance_objects_by_address.get(address);
    }

    /**
     *  If there is not already a pending request to fetch this object, a new
     *  request will be made.
     *
     *  @return null if the object does not exist,
     *  @return undefined if the object might exist but is not in cache
     *  @return the object if it does exist and is in our cache
     */
    fetchObject(
        id,
        force = false,
        autosubscribe = null,
        no_full_account = false
    ) {
        if (autosubscribe == null) {
            autosubscribe = default_auto_subscribe;
        }
        if (typeof id !== "string") {
            let result = [];
            for (let i = 0; i < id.length; ++i)
                result.push(this.fetchObject(id[i], force, autosubscribe));
            return result;
        }

        if (DEBUG)
            console.log(
                "!!! fetchObject: ",
                id,
                this.subscribed,
                !this.subscribed && !force
            );
        if (!this.subscribed && !force) return undefined;

        if (DEBUG) console.log("maybe fetch object: ", id);
        if (!ChainValidation.is_object_id(id))
            throw Error("argument is not an object id: " + id);

        if (id.search("1.2.") === 0 && !no_full_account)
            return this.fetchFullAccount(id, autosubscribe);
        if (id.search(witness_prefix) === 0) this._subTo("witnesses", id);
        if (id.search(committee_prefix) === 0) this._subTo("committee", id);

        let result = this.objects_by_id.get(id);
        if (result === undefined) {
            // the fetch
            if (DEBUG) console.log("fetching object: ", id);
            this.objects_by_id.set(id, true);
            if (!Apis.instance().db_api()) return null;
            Apis.instance()
                .db_api()
                .exec("get_objects", [[id]])
                .then(optional_objects => {
                    //if(DEBUG) console.log("... optional_objects",optional_objects ? optional_objects[0].id : null)
                    for (let i = 0; i < optional_objects.length; i++) {
                        let optional_object = optional_objects[i];
                        if (optional_object) {
                            this._updateObject(optional_object, true);
                        } else {
                            this.objects_by_id.set(id, null);
                            this.notifySubscribers();
                        }
                    }
                })
                .catch(error => {
                    // in the event of an error clear the pending state for id
                    console.log("!!! Chain API error", error);
                    this.objects_by_id.delete(id);
                });
        } else if (result === true)
            // then we are waiting a response
            return undefined;
        return result; // we have a response, return it
    }

    /**
     *  @return null if no such account exists
     *  @return undefined if such an account may exist, and fetch the the full account if not already pending
     *  @return the account object if it does exist
     */
    getAccount(name_or_id, autosubscribe = null) {
        if (autosubscribe == null) {
            autosubscribe = default_auto_subscribe;
        }
        if (!name_or_id) return null;

        if (typeof name_or_id === "object") {
            if (name_or_id.id)
                return this.getAccount(name_or_id.id, autosubscribe);
            else if (name_or_id.get)
                return this.getAccount(name_or_id.get("id"), autosubscribe);
            else return undefined;
        }

        if (ChainValidation.is_object_id(name_or_id)) {
            let account = this.getObject(name_or_id, false, autosubscribe);
            if (account === null) {
                return null;
            }
            /* If sub status changes from false to true, force full fetch */
            const currentSub = this.get_full_accounts_subscriptions.get(
                name_or_id,
                false
            );
            if (
                (!currentSub && autosubscribe) ||
                account === undefined ||
                account.get("name") === undefined
            ) {
                return this.fetchFullAccount(name_or_id, autosubscribe);
            }
            return account;
        } else if (ChainValidation.is_account_name(name_or_id, true)) {
            let account_id = this.accounts_by_name.get(name_or_id);
            if (account_id === null) return null; // already fetched and it wasn't found
            if (account_id === undefined)
                // then no query, fetch it
                return this.fetchFullAccount(name_or_id, autosubscribe);

            return this.getObject(account_id, false, autosubscribe); // return it
        } else {
            return null;
        }
        //throw Error( `Argument is not an account name or id: ${name_or_id}` )
    }

    /**
     *  @return undefined if the account name is not yet cached, and fetch the the full account if not already pending
     *  @return null if the account name or id are unvalid, or the account does not exist
     *  @return the account name
     */
    getAccountName(id) {
        let account = this.objects_by_id.get(id);
        if (account === true) return undefined;
        if (!account) {
            this.getObject(id, false, false, true);
            return undefined;
        }
        return account.get("name");
    }

    /**
     * This method will attempt to lookup witness by account_id.
     * If witness doesn't exist it will return null, if witness is found it will return witness object,
     * if it's not fetched yet it will return undefined.
     * @param account_id - account id
     */
    getWitnessById(account_id) {
        let witness_id = this.witness_by_account_id.get(account_id);
        if (witness_id === undefined) {
            this.fetchWitnessByAccount(account_id);
            return undefined;
        } else if (witness_id) {
            this._subTo("witnesses", witness_id);
        }

        return witness_id ? this.getObject(witness_id) : null;
    }

    /**
     * This method will attempt to lookup committee member by account_id.
     * If committee member doesn't exist it will return null, if committee member is found it will return committee member object,
     * if it's not fetched yet it will return undefined.
     * @param account_id - account id
     */
    getCommitteeMemberById(account_id) {
        let cm_id = this.committee_by_account_id.get(account_id);
        if (cm_id === undefined) {
            this.fetchCommitteeMemberByAccount(account_id);
            return undefined;
        } else if (cm_id) {
            this._subTo("committee", cm_id);
        }
        return cm_id ? this.getObject(cm_id) : null;
    }

    /**
     *
     * @return a promise with the workers array
     */
    fetchAllWorkers() {
        return new Promise((resolve, reject) => {
            Apis.instance()
                .db_api()
                .exec("get_all_workers", [])
                .then(workers_array => {
                    if (workers_array && workers_array.length) {
                        workers_array.forEach(worker => {
                            this._updateObject(worker, false);
                        });
                        resolve(workers_array);
                        this.notifySubscribers();
                    } else {
                        resolve([]);
                    }
                }, reject);
        });
    }

    /**
     *
     * @return a promise with the witness object
     */
    fetchWitnessByAccount(account_id) {
        return new Promise((resolve, reject) => {
            Apis.instance()
                .db_api()
                .exec("get_witness_by_account", [account_id])
                .then(optional_witness_object => {
                    if (optional_witness_object) {
                        this._subTo("witnesses", optional_witness_object.id);
                        this.witness_by_account_id = this.witness_by_account_id.set(
                            optional_witness_object.witness_account,
                            optional_witness_object.id
                        );
                        let witness_object = this._updateObject(
                            optional_witness_object,
                            true
                        );
                        resolve(witness_object);
                    } else {
                        this.witness_by_account_id = this.witness_by_account_id.set(
                            account_id,
                            null
                        );
                        this.notifySubscribers();
                        resolve(null);
                    }
                }, reject);
        });
    }
    /**
     *
     * @return a promise with the witness object
     */
    fetchCommitteeMemberByAccount(account_id) {
        return new Promise((resolve, reject) => {
            Apis.instance()
                .db_api()
                .exec("get_committee_member_by_account", [account_id])
                .then(optional_committee_object => {
                    if (optional_committee_object) {
                        this._subTo("committee", optional_committee_object.id);
                        this.committee_by_account_id = this.committee_by_account_id.set(
                            optional_committee_object.committee_member_account,
                            optional_committee_object.id
                        );
                        let committee_object = this._updateObject(
                            optional_committee_object,
                            true
                        );
                        resolve(committee_object);
                    } else {
                        this.committee_by_account_id = this.committee_by_account_id.set(
                            account_id,
                            null
                        );
                        this.notifySubscribers();
                        resolve(null);
                    }
                }, reject);
        });
    }

    /***
     * Sets flags to enable request of more data when loading fetchFullAccount
     * based on the new API limitations of objects.
     */
    requestAllDataForAccount(account_id, object_type) {
        let current = this.objects_by_id.get(account_id);

        /***
         * TODO
         * Include additional object_types to fetch that chain will limit and warn about
         * By quering more_data_available the following are currently possible options
         * assets, call_orders, htlcs_from, htlcs_to, limit_orders, proposals, settle_orders, vesting_balances, withdraws_from, withdraws_to
         */

        if (current.toJS().more_data_available.balances && object_type == "balance") {
            Apis.instance()
                .db_api()
                .exec("get_account_balances", [account_id, []])
                .then(balances => {
                    current.balances = balances;
                })
            this._updateObject(current);
        }
    }
    

    /**
     *  Fetches an account and all of its associated data in a single query
     *
     *  @param an account name or account id
     *
     *  @return undefined if the account in question is in the process of being fetched
     *  @return the object if it has already been fetched
     *  @return null if the object has been queried and was not found
     */
    fetchFullAccount(name_or_id, autosubscribe = null) {
        if (autosubscribe == null) {
            autosubscribe = default_auto_subscribe;
        }
        if (DEBUG) console.log("Fetch full account: ", name_or_id);

        let fetch_account = false;
        const subChanged =
            this.get_full_accounts_subscriptions.has(name_or_id) &&
            (this.get_full_accounts_subscriptions.get(name_or_id) === false &&
                autosubscribe);

        const is_object_id = ChainValidation.is_object_id(name_or_id);
        const is_account_name =
            !is_object_id && ChainValidation.is_account_name(name_or_id, true);

        if (is_object_id && !subChanged) {
            let current = this.objects_by_id.get(name_or_id);
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

            let account_id = this.accounts_by_name.get(name_or_id);
            if (ChainValidation.is_object_id(account_id))
                return this.getAccount(account_id, autosubscribe);
        }

        /// only fetch once every 5 seconds if it wasn't found, or if the subscribe status changed to true
        if (
            subChanged ||
            !this.fetching_get_full_accounts.has(name_or_id) ||
            Date.now() - this.fetching_get_full_accounts.get(name_or_id) > 5000
        ) {
            this.fetching_get_full_accounts.set(name_or_id, Date.now());
            Apis.instance()
                .db_api()
                .exec("get_full_accounts", [[name_or_id], autosubscribe])
                .then(results => {
                    if (results.length === 0) {
                        if (is_object_id) {
                            this.objects_by_id.set(name_or_id, null);
                            this.notifySubscribers();
                        } else if (is_account_name) {
                            this.accounts_by_name.set(name_or_id, null);
                            this.notifySubscribers();
                        }
                        return;
                    }
                    let full_account = results[0][1];
                    this.get_full_accounts_subscriptions.set(
                        full_account.account.name,
                        autosubscribe
                    );
                    this.get_full_accounts_subscriptions.set(
                        full_account.account.id,
                        autosubscribe
                    );
                    if (DEBUG) console.log("full_account: ", full_account);
                    /* Add this account to list of subbed accounts */
                    this._subTo("accounts", full_account.account.id);
                    let {
                        account,
                        assets,
                        vesting_balances,
                        statistics,
                        call_orders,
                        settle_orders,
                        more_data_available,
                        limit_orders,
                        referrer_name,
                        registrar_name,
                        lifetime_referrer_name,
                        votes,
                        proposals,
                        htlcs_from,
                        htlcs_to
                    } = full_account;

                    // ensure backwards compatibility if node is not up-to-date
                    if (!htlcs_from) { // available with 3.1.X
                        htlcs_from = []
                    }
                    if (!htlcs_to) { // available with 3.1.X
                        htlcs_to = []
                    }
                    if (!settle_orders) { // available with 3.0.X
                        settle_orders = []
                    }
                    if (!more_data_available) {
                        more_data_available = []
                    }

                    this.accounts_by_name.set(account.name, account.id);
                    account.assets = new Immutable.List(assets || []);
                    account.referrer_name = referrer_name;
                    account.lifetime_referrer_name = lifetime_referrer_name;
                    account.registrar_name = registrar_name;
                    account.balances = {};
                    account.more_data_available = more_data_available;
                    account.orders = new Immutable.Set();
                    account.vesting_balances = new Immutable.Set();
                    account.balances = new Immutable.Map();
                    account.call_orders = new Immutable.Set();
                    account.settle_orders = new Immutable.Set();
                    account.proposals = new Immutable.Set();
                    account.htlcs_to = new Immutable.Set();
                    account.htlcs_from = new Immutable.Set();
                    account.vesting_balances = account.vesting_balances.withMutations(
                        set => {
                            vesting_balances.forEach(vb => {
                                this._updateObject(vb);
                                set.add(vb.id);
                            });
                        }
                    );

                    let sub_to_objects = [];

                    votes.forEach(v => this._updateObject(v));

                    account.balances = account.balances.withMutations(map => {
                        full_account.balances.forEach(b => {
                            this._updateObject(b);
                            map.set(b.asset_type, b.id);
                            if (autosubscribe) sub_to_objects.push(b.id);
                        });
                    });
                    account.orders = account.orders.withMutations(set => {
                        limit_orders.forEach(order => {
                            this._updateObject(order);
                            set.add(order.id);
                            if (autosubscribe) sub_to_objects.push(order.id);
                        });
                    });
                    account.call_orders = account.call_orders.withMutations(
                        set => {
                            call_orders.forEach(co => {
                                this._updateObject(co);
                                set.add(co.id);
                                if (autosubscribe) sub_to_objects.push(co.id);
                            });
                        }
                    );
                    account.settle_orders = account.settle_orders.withMutations(
                        set => {
                            settle_orders.forEach(so => {
                                this._updateObject(so);
                                set.add(so.id);
                                if (autosubscribe) sub_to_objects.push(so.id);
                            });
                        }
                    );
                    account.htlcs_to = account.htlcs_to.withMutations(
                        set => {
                            htlcs_to.forEach(htlc => {
                                this._updateObject(htlc);
                                set.add(htlc.id);
                                if (autosubscribe) sub_to_objects.push(htlc.id);
                            });
                        }
                    );
                    account.htlcs_from = account.htlcs_from.withMutations(
                        set => {
                            htlcs_from.forEach(htlc => {
                                this._updateObject(htlc);
                                set.add(htlc.id);
                                if (autosubscribe) sub_to_objects.push(htlc.id);
                            });
                        }
                    );
                    account.proposals = account.proposals.withMutations(set => {
                        proposals.forEach(p => {
                            this._updateObject(p);
                            set.add(p.id);
                            if (autosubscribe) sub_to_objects.push(p.id);
                        });
                    });

                    /*
                        * In order to receive notifications for these objects
                        * we need to manually fetch them with get_objects. This
                        * is only done if autosubscribe is true
                        */
                    if (sub_to_objects.length)
                        Apis.instance()
                            .db_api()
                            .exec("get_objects", [sub_to_objects]);

                    this._updateObject(statistics);
                    let updated_account = this._updateObject(account);
                    this.fetchRecentHistory(updated_account);
                    this.notifySubscribers();
                })
                .catch(error => {
                    // console.log("get_full_accounts: ", error, error.message === "Assert Exception: account: no such account");
                    if (
                        error &&
                        error.message ===
                            "Assert Exception: account: no such account"
                    ) {
                        if (is_object_id) {
                            this.objects_by_id.set(name_or_id, null);
                            this.notifySubscribers();
                        } else if (is_account_name) {
                            this.accounts_by_name.set(name_or_id, null);
                            this.notifySubscribers();
                        }
                    } else {
                        if (is_object_id) this.objects_by_id.delete(name_or_id);
                        else this.accounts_by_name.delete(name_or_id);
                    }
                });
        }
        return undefined;
    }

    getAccountMemberStatus(account) {
        if (account === undefined) return undefined;
        if (account === null) return "unknown";
        if (account.get("lifetime_referrer") == account.get("id"))
            return "lifetime";
        let exp = new Date(account.get("membership_expiration_date")).getTime();
        let now = new Date().getTime();
        if (exp < now) return "basic";
        return "annual";
    }

    getAccountBalance(account, asset_type) {
        let balances = account.get("balances");
        if (!balances) return 0;

        let balance_obj_id = balances.get(asset_type);
        if (balance_obj_id) {
            let bal_obj = this.objects_by_id.get(balance_obj_id);
            if (bal_obj) return bal_obj.get("balance");
        }
        return 0;
    }

    /**
     * There are two ways to extend the account history, add new more
     * recent history, and extend historic hstory. This method will fetch
     * the most recent account history and prepend it to the list of
     * historic operations.
     *
     *  @param account immutable account object
     *  @return a promise with the account history
     */
    fetchRecentHistory(account, limit = 100) {
        // console.log( "get account history: ", account )
        /// TODO: make sure we do not submit a query if there is already one
        /// in flight...
        let account_id = account;
        if (!ChainValidation.is_object_id(account_id) && account.toJS)
            account_id = account.get("id");

        if (!ChainValidation.is_object_id(account_id)) return;

        account = this.objects_by_id.get(account_id);
        if (!account || account === true) return;

        let pending_request = this.account_history_requests.get(account_id);
        if (pending_request) {
            pending_request.requests++;
            return pending_request.promise;
        } else pending_request = {requests: 0};

        let most_recent = "1." + op_history + ".0";
        let history = account.get("history");

        if (history && history.size) most_recent = history.first().get("id");

        /// starting at 0 means start at NOW, set this to something other than 0
        /// to skip recent transactions and fetch the tail
        let start = "1." + op_history + ".0";

        pending_request.promise = new Promise((resolve, reject) => {
            Apis.instance()
                .history_api()
                .exec("get_account_history", [
                    account_id,
                    most_recent,
                    limit,
                    start
                ])
                .then(operations => {
                    let current_account = this.objects_by_id.get(account_id);
                    if (!current_account) return;
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
                    this.objects_by_id.set(account_id, updated_account);

                    //if( current_history != updated_history )
                    //   this._notifyAccountSubscribers( account_id )

                    let pending_request = this.account_history_requests.get(
                        account_id
                    );
                    this.account_history_requests.delete(account_id);
                    if (pending_request.requests > 0) {
                        // it looks like some more history may have come in while we were
                        // waiting on the result, lets fetch anything new before we resolve
                        // this query.
                        this.fetchRecentHistory(updated_account, limit).then(
                            resolve,
                            reject
                        );
                    } else resolve(updated_account);
                }); // end then
        });

        this.account_history_requests.set(account_id, pending_request);
        return pending_request.promise;
    }

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
    _updateObject(object, notify_subscribers = false, emit = true) {
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
                    !this._isSubbedTo(
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
                if (!this._isSubbedTo("witnesses", object.id)) {
                    return;
                }
                break;

            case "committee_member":
                if (!this._isSubbedTo("committee", object.id)) {
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
                100 *
                (BigInteger(object.recent_slots_filled).bitCount() / 128.0);
            this.head_block_time_string = object.time;
            this.chain_time_offset.push(
                Date.now() - timeStringToDate(object.time).getTime()
            );
            if (this.chain_time_offset.length > 10)
                this.chain_time_offset.shift(); // remove first
        }

        let current = this.objects_by_id.get(object.id);
        if (!current) {
            // console.log("add object:", object.id);
            current = Immutable.Map();
        }
        let prior = current;

        /* New object */
        if (current === undefined || current === true)
            this.objects_by_id.set(
                object.id,
                (current = Immutable.fromJS(object))
            );
        else {
            /* Existing object */ switch (objectType) {
                /*
                * These cases have additional data attached inside the chainstore,
                * so we need to use mergeDeep to keep that data
                */
                case "account":
                case "asset":
                case "asset_bitasset_data":
                    this.objects_by_id.set(
                        object.id,
                        (current = current.mergeDeep(Immutable.fromJS(object)))
                    );
                    break;

                /* Don't use merge deep to improve performance */
                default:
                    this.objects_by_id.set(
                        object.id,
                        (current = Immutable.fromJS(object))
                    );
            }
        }

        /* Special handling for various objects */

        // BALANCE OBJECT

        switch (objectType) {
            case "account_balance":
                let owner = this.objects_by_id.get(object.owner);
                if (owner === undefined || owner === null || owner === true) {
                    return;
                } else {
                    let balances = owner.get("balances");
                    if (!balances)
                        owner = owner.set("balances", Immutable.Map());
                    owner = owner.setIn(
                        ["balances", object.asset_type],
                        object.id
                    );
                }
                this.objects_by_id.set(object.owner, owner);
                break;

            case "account_statistics":
                try {
                    let prior_most_recent_op = prior.get(
                        "most_recent_op",
                        "2.9.0"
                    );

                    if (prior_most_recent_op != object.most_recent_op) {
                        this.fetchRecentHistory(object.owner);
                    }
                } catch (err) {
                    console.log("object:", object, "prior", prior, "err:", err);
                }
                break;

            case "witness":
                if (this._isSubbedTo("witnesses", object.id)) {
                    this.witness_by_account_id.set(
                        object.witness_account,
                        object.id
                    );
                    this.objects_by_vote_id.set(object.vote_id, object.id);
                } else {
                    return;
                }
                break;

            case "committee_member":
                if (this._isSubbedTo("committee", object.id)) {
                    this.committee_by_account_id.set(
                        object.committee_member_account,
                        object.id
                    );
                    this.objects_by_vote_id.set(object.vote_id, object.id);
                } else {
                    return;
                }
                break;

            case "worker":
                this.objects_by_vote_id.set(object.vote_for, object.id);
                this.objects_by_vote_id.set(object.vote_against, object.id);

                if (!this.workers.has(object.id)) this.workers.add(object.id);
                break;

            case "account":
                current = current.set(
                    "active",
                    Immutable.fromJS(object.active)
                );
                current = current.set("owner", Immutable.fromJS(object.owner));
                current = current.set(
                    "options",
                    Immutable.fromJS(object.options)
                );
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
                this.objects_by_id.set(object.id, current);
                this.accounts_by_name.set(object.name, object.id);

                break;

            case "asset":
                this.assets_by_symbol.set(object.symbol, object.id);

                // make sure we fetch the bitasset data object
                let bitasset = current.get("bitasset");
                if (!bitasset && "bitasset_data_id" in object) {
                    let bad = this.getObject(object.bitasset_data_id, true);
                    if (!bad) bad = Immutable.Map();

                    if (!bad.get("asset_id")) {
                        bad = bad.set("asset_id", object.id);
                    }
                    this.objects_by_id.set(object.bitasset_data_id, bad);

                    current = current.set("bitasset", bad);
                    this.objects_by_id.set(object.id, current);
                }
                break;

            case "asset_bitasset_data":
                let asset_id = current.get("asset_id");
                if (asset_id) {
                    let asset = this.getObject(asset_id);
                    if (asset) {
                        asset = asset.set("bitasset", current);
                        emitter.emit("bitasset-update", asset);
                        this.objects_by_id.set(asset_id, asset);
                    }
                }
                break;

            case "call_order":
                if (emit) {
                    emitter.emit("call-order-update", object);
                }

                let call_account = this.objects_by_id.get(object.borrower);
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
                        this.objects_by_id.set(
                            call_account.get("id"),
                            call_account
                        );
                        Apis.instance()
                            .db_api()
                            .exec("get_objects", [[object.id]]); // Force subscription to the object in the witness node by calling get_objects
                    }
                }
                break;

            case "limit_order":
                let limit_account = this.objects_by_id.get(object.seller);
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
                        this.objects_by_id.set(
                            limit_account.get("id"),
                            limit_account
                        );
                        Apis.instance()
                            .db_api()
                            .exec("get_objects", [[object.id]]); // Force subscription to the object in the witness node by calling get_objects
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
                    this.addProposalData(
                        object.required_active_approvals,
                        object.id
                    );
                notify_subscribers =
                    notify_subscribers ||
                    this.addProposalData(
                        object.required_owner_approvals,
                        object.id
                    );
                break;

            default:
        }

        if (notify_subscribers) {
            this.notifySubscribers();
        }
        return current;
    }

    getObjectsByVoteIds(vote_ids) {
        let result = [];
        let missing = [];
        for (let i = 0; i < vote_ids.length; ++i) {
            let obj = this.objects_by_vote_id.get(vote_ids[i]);
            if (obj) result.push(this.getObject(obj));
            else {
                result.push(null);
                missing.push(vote_ids[i]);
            }
        }

        if (missing.length) {
            // we may need to fetch some objects
            Apis.instance()
                .db_api()
                .exec("lookup_vote_ids", [missing])
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
                                    witness_prefix.length
                                ) == witness_prefix;
                            this._subTo(
                                isWitness ? "witnesses" : "committee",
                                vote_obj_array[i].id
                            );
                            this._updateObject(vote_obj_array[i]);
                        }
                    }
                })
                .catch(error => {
                    console.log("Error looking up vote ids: ", error);
                });
        }
        return result;
    }

    getObjectByVoteID(vote_id) {
        let obj_id = this.objects_by_vote_id.get(vote_id);
        if (obj_id) return this.getObject(obj_id);
        return undefined;
    }

    getHeadBlockDate() {
        return timeStringToDate(this.head_block_time_string);
    }

    getEstimatedChainTimeOffset() {
        if (this.chain_time_offset.length === 0) return 0;
        // Immutable is fast, sorts numbers correctly, and leaves the original unmodified
        // This will fix itself if the user changes their clock
        var median_offset = Immutable.List(this.chain_time_offset)
            .sort()
            .get(Math.floor((this.chain_time_offset.length - 1) / 2));
        // console.log("median_offset", median_offset)
        return median_offset;
    }

    addProposalData(approvals, objectId) {
        let didImpact = false;
        approvals.forEach(id => {
            let impactedAccount = this.objects_by_id.get(id);
            if (impactedAccount && impactedAccount !== true) {
                didImpact = true;
                let proposals = impactedAccount.get(
                    "proposals",
                    Immutable.Set()
                );

                if (!proposals.includes(objectId)) {
                    proposals = proposals.add(objectId);
                    impactedAccount = impactedAccount.set(
                        "proposals",
                        proposals
                    );
                    this.objects_by_id.set(
                        impactedAccount.get("id"),
                        impactedAccount
                    );
                }
            }
        });
        return didImpact;
    }
}

let chain_store = new ChainStore();

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
chain_store.FetchChainObjects = FetchChainObjects;

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

chain_store.FetchChain = FetchChain;

function timeStringToDate(time_string) {
    if (!time_string) return new Date("1970-01-01T00:00:00.000Z");
    if (!/Z$/.test(time_string)) {
        //does not end in Z
        // https://github.com/cryptonomex/graphene/issues/368
        time_string = time_string + "Z";
    }
    return new Date(time_string);
}

export default chain_store;
