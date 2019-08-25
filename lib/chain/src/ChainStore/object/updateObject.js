import BigInteger from "bigi";
import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import {getObjectType, emitter, timeStringToDate} from "../utils";
import {_isSubbedTo, notifySubscribers} from "../subscribe";
import {
    headBlockTimeString,
    chainTimeOffset,
    objectById,
    witnessByAccountId,
    objectsByVoteId,
    committeeByAccountId,
    accountsByName,
    assetsBySymbol,
    workers
} from "../store";

import {fetchRecentHistory} from "../account";
import {addProposalData} from "../proposal";

import {getObject} from "./getObject";

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
export const updateObject = (
    object,
    notify_subscribers = false,
    emit = true
) => {
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
