import {objectById} from "./store";

export const addProposalData = (approvals, objectId) => {
    let didImpact = false;
    approvals.forEach(id => {
        let impactedAccount = objectById.get(id);
        if (impactedAccount && impactedAccount !== true) {
            didImpact = true;
            let proposals = impactedAccount.get("proposals", Immutable.Set());

            if (!proposals.includes(objectId)) {
                proposals = proposals.add(objectId);
                impactedAccount = impactedAccount.set("proposals", proposals);
                objectById.set(impactedAccount.get("id"), impactedAccount);
            }
        }
    });
    return didImpact;
};
