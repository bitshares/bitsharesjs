import {objectById} from "../store";

export const getAccountBalance = (account, asset_type) => {
    let balances = account.get("balances");
    if (!balances) return 0;

    let balance_obj_id = balances.get(asset_type);
    if (balance_obj_id) {
        let bal_obj = objectById.get(balance_obj_id);
        if (bal_obj) return bal_obj.get("balance");
    }
    return 0;
};
