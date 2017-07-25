import {Apis} from "gxbjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder, hash} from "../lib";

var privKey = "";
let pKey = PrivateKey.fromWif(privKey);

Apis.instance("ws://192.168.1.118:28090", true)
    .init_promise.then((res) => {

    ChainStore.init().then(() => {

        let tr = new TransactionBuilder();

        let request_id = "22e6debefca11b97bcb89554803c34d6c58bcbf8e7b50f2e290a46e3d14cabfb";

        tr.add_type_operation('pay_data_transaction', {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            request_id: request_id
        });

        tr.set_required_fees().then(() => {
            tr.add_signer(pKey);
            console.log("serialized transaction:", JSON.stringify(tr.serialize(), null, '\t'));
            tr.broadcast();
        }, (ex)=> {
            console.error(ex);
        })
    }, (ex)=> {
        console.error(ex);
    });
}, (ex)=> {
    console.error(ex);
});
