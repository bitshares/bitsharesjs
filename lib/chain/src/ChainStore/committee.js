import {Apis} from "bitsharesjs-ws";
import {committeeByAccountId} from "./store";
import {_subTo, notifySubscribers} from "./subscribe";
import {getObject, updateObject} from "./object";

/**
 * This method will attempt to lookup committee member by account_id.
 * If committee member doesn't exist it will return null, if committee member is found it will return committee member object,
 * if it's not fetched yet it will return undefined.
 * @param account_id - account id
 */
export const getCommitteeMemberById = account_id => {
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
 * @return a promise with the witness object
 */
export const fetchCommitteeMemberByAccount = account_id => {
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
                    let committee_object = updateObject(
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
