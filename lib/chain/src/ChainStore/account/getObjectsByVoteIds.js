import {Apis} from "bitsharesjs-ws";
import {getObject, updateObject} from "../object";
import {objectsByVoteId} from "../store";
import {WITNESS_PREFIX} from "../utils";
import {_subTo} from "../subscribe";

export const getObjectByVoteID = vote_id => {
    let obj_id = objectsByVoteId.get(vote_id);
    if (obj_id) return getObject(obj_id);
    return undefined;
};

export const getObjectsByVoteIds = vote_ids => {
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
                        updateObject(vote_obj_array[i]);
                    }
                }
            })
            .catch(error => {
                console.log("Error looking up vote ids: ", error);
            });
    }
    return result;
};
