import {Apis} from "gxbjs-ws";
import {
    ChainStore,
    hash,
    ops
} from "../lib";

let block_id = '895414'
Apis.instance("ws://192.168.2.244:28090", true).init_promise.then((res) => {
    ChainStore.init().then(() => {
        Apis.instance().db_api().exec("get_block", [block_id]).then(results => {
            results.transactions.forEach((transaction)=>{
                let tr_buffer=ops.transaction.toBuffer(transaction)
                let result  = hash.sha256(tr_buffer).toString('hex').substr(0,40);
                console.log(result);
            });
        }).catch(error => { // in the event of an error clear the pending state for id
            console.error(error);
        });
    });
});

