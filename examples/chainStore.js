import {Apis} from "gxbjs-ws";
import {ChainStore} from "../lib";

Apis.instance("wss://node5.gxb.io", true).init_promise.then((res) => {
    ChainStore.init().then(() => {
        ChainStore.subscribe(updateState);
        dynamicGlobal = ChainStore.getObject("2.1.0");
    });
});

let dynamicGlobal = null;
function updateState(object) {
    console.log("ChainStore object update\n", dynamicGlobal ? dynamicGlobal.toJS() : dynamicGlobal);
}
