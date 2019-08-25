import ChainValidation from "../../ChainValidation";
import {Apis} from "bitsharesjs-ws";
import {objectById, subscribed} from "../store";
import {
    DEFAULT_AUTO_SUBSCRIBE,
    WITNESS_PREFIX,
    COMMITTEE_PREFIX,
    DEBUG
} from "../utils";

import {updateObject} from "./updateObject";
import {notifySubscribers} from "../subscribe";
import {fetchFullAccount} from "../account";

/**
 *  If there is not already a pending request to fetch this object, a new
 *  request will be made.
 *
 *  @return null if the object does not exist,
 *  @return undefined if the object might exist but is not in cache
 *  @return the object if it does exist and is in our cache
 */
export const fetchObject = (
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
                        updateObject(optional_object, true);
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
