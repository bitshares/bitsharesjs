import {Apis} from "bitsharesjs-ws";
import Immutable from "immutable";
import {balanceObjectsByAddress} from "../store";
import {updateObject} from "./updateObject";

/**
 * @return a Set of balance ids that are claimable with the given address
 * @return undefined if a query is pending and the set is not known at this time
 * @return a empty Set if no items are found
 *
 * If this method returns undefined, then it will send a request to the server for
 * the current state after which it will be subscribed to changes to this set.
 */
export const getBalanceObjects = address => {
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
                    updateObject(balance_objects[i]);
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
