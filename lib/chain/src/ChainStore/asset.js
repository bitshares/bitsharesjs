import {Apis} from "bitsharesjs-ws";
import ChainValidation from "../ChainValidation";
import {assetsBySymbol} from "./store";
import {getObject, updateObject} from "./object";
import {notifySubscribers} from "./subscribe";

/**
 *  @return undefined if a query is pending
 *  @return null if id_or_symbol has been queired and does not exist
 *  @return object if the id_or_symbol exists
 */
export const getAsset = id_or_symbol => {
    if (!id_or_symbol) return null;

    if (ChainValidation.is_object_id(id_or_symbol)) {
        let asset = getObject(id_or_symbol);

        if (
            asset &&
            (asset.get("bitasset") &&
                !asset.getIn(["bitasset", "current_feed"]))
        ) {
            return undefined;
        }
        return asset;
    }

    /// TODO: verify id_or_symbol is a valid symbol name

    let asset_id = assetsBySymbol.get(id_or_symbol);

    if (ChainValidation.is_object_id(asset_id)) {
        let asset = getObject(asset_id);

        if (
            asset &&
            (asset.get("bitasset") &&
                !asset.getIn(["bitasset", "current_feed"]))
        ) {
            return undefined;
        }
        return asset;
    }

    if (asset_id === null) return null;

    if (asset_id === true) return undefined;
    Apis.db
        .lookup_asset_symbols([id_or_symbol])
        .then(asset_objects => {
            if (asset_objects.length && asset_objects[0])
                updateObject(asset_objects[0], true);
            else {
                assetsBySymbol.set(id_or_symbol, null);
                notifySubscribers();
            }
        })
        .catch(error => {
            console.log("Error: ", error);
            assetsBySymbol.delete(id_or_symbol);
        });

    return undefined;
};
