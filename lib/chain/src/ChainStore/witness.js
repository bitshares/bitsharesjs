import {Apis} from "bitsharesjs-ws";
import {witnessByAccountId} from "./store";
import {_subTo, notifySubscribers} from "./subscribe";
import {getObject, updateObject} from "./object";

/**
 * This method will attempt to lookup witness by account_id.
 * If witness doesn't exist it will return null, if witness is found it will return witness object,
 * if it's not fetched yets it will return undefined.
 * @param account_id - account id
 */
export const getWitnessById = account_id => {
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
 *
 * @return a promise with the witness object
 */
export const fetchWitnessByAccount = account_id => {
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
                    let witness_object = updateObject(
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
