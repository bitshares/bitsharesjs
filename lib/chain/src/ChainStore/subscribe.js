import {
    dispatched,
    dispatchFrequency,
    timeout,
    subbed,
    objectById,
    subscribers
} from "./store";

export const notifySubscribers = () => {
    // Dispatch at most only once every x milliseconds
    if (!dispatched.get()) {
        dispatched.set(true);
        timeout.set(
            setTimeout(() => {
                dispatched.set(false);
                subscribers.forEach(callback => callback());
            }, dispatchFrequency.get())
        );
    }
};

export const _subTo = (type, id) => {
    !subbed[type].has(id) && subbed[type].add(id);
};

export const unSubFrom = (type, id) => {
    subbed[type].delete(id);
    objectById.delete(id);
};

export const _isSubbedTo = (type, id) => subbed[type].has(id);

/**
 *  Add a callback that will be called anytime any object in the cache is updated
 */
export const subscribe = callback => {
    if (subscribers.has(callback))
        return console.error("Subscribe callback already exists", callback);
    subscribers.add(callback);
};

/**
 *  Remove a callback that was previously added via subscribe
 */
export const unsubscribe = callback => {
    if (!subscribers.has(callback))
        return console.error("Unsubscribe callback does not exists", callback);
    subscribers.delete(callback);
};
