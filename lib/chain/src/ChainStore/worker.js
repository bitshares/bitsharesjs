import {Apis} from "bitsharesjs-ws";
import {updateObject} from "./object";
import {notifySubscribers} from "./subscribe";

/**
 *
 * @return a promise with the workers array
 */
export const fetchAllWorkers = () => {
    return new Promise((resolve, reject) => {
        Apis.db.get_all_workers().then(workers_array => {
            if (workers_array && workers_array.length) {
                workers_array.forEach(worker => {
                    updateObject(worker, false);
                });
                resolve(workers_array);
                notifySubscribers();
            } else {
                resolve([]);
            }
        }, reject);
    });
};
