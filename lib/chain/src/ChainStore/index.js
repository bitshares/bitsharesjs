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
import {
    emitter,
    getObjectType,
    clearObjectCache,
    getHeadBlockDate,
    timeStringToDate,
    getEstimatedChainTimeOffset
} from "./utils";

import {addProposalData} from "./proposal";
import {
    getAccountRefsOfKey,
    getAccountRefsOfAccount,
    getAccountMemberStatus,
    getAccountBalance,
    fetchRecentHistory,
    fetchFullAccount,
    getAccount,
    getAccountName,
    getObjectByVoteID,
    getObjectsByVoteIds
} from "./account";

import {
    clearSubscirbers,
    subscribed,
    chainTimeOffset,
    dispatchFrequency,
    subbed,
    objectById,
    subError,
    headBlockTimeString,
    clearCache
} from "./store";

import {
    _subTo,
    _isSubbedTo,
    unSubFrom,
    subscribe,
    unsubscribe,
    notifySubscribers
} from "./subscribe";

import {getAsset} from "./asset";
import {
    updateObject,
    getObject,
    fetchObject,
    getBalanceObjects
} from "./object";
import {
    getCommitteeMemberById,
    fetchCommitteeMemberByAccount
} from "./committee";
import {getWitnessById, fetchWitnessByAccount} from "./witness";
import {fetchAllWorkers} from "./worker";

//clearCache();

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
                     ** updateObject is commented out here
                     */
                    // updateObject( optionalObject, true );

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

const onUpdate = (
    updated_objects /// map from account id to objects
) => {
    let cancelledOrders = [];
    let closedCallOrders = [];

    updated_objects.forEach(objects =>
        objects.forEach(obj => {
            if (!ChainValidation.is_object_id(obj)) updateObject(obj);
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
    //_subTo,
    unSubFrom,
    //_isSubbedTo,
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
    //updateObject,
    getObjectsByVoteIds,
    getObjectByVoteID,
    getHeadBlockDate,
    getEstimatedChainTimeOffset,
    addProposalData,
    FetchChain,
    FetchChainObjects
};

export default chain_store;
