import {Apis} from "gxbjs-ws";
import {ChainStore,EmitterInstance} from "../lib";
let emitter = EmitterInstance();

Apis.instance("http://192.168.1.118:28090", true).init_promise.then((res) => {
    ChainStore.init().then(() => {
        ChainStore.subscribe_for_data_transaction(updateState);
    });
});

function updateState(object) {
    console.log(JSON.stringify(object,null,'\t'));
}
