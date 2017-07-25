import {Apis} from "gxbjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder, hash} from "../lib";

var privKey = "";
let pKey = PrivateKey.fromWif(privKey);

Apis.instance("ws://192.168.1.118:28090", true)
    .init_promise.then((res) => {

    ChainStore.init().then(() => {

        let tr = new TransactionBuilder();

        let request_id = "0793bbb9133b8f4f202619a0f6f92e5d9e44010ece00ec57830c8993014fdc2c";

        tr.add_type_operation('data_transaction_datasource_validate_error', {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            request_id: request_id,
            datasource:'1.2.19'
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
