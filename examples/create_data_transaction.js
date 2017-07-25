import {Apis} from "gxbjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder,hash} from "../lib";

var privKey = "";
let pKey = PrivateKey.fromWif(privKey);

Apis.instance("ws://192.168.1.118:28090", true)
    .init_promise.then((res) => {

    let pubKey =pKey.toPublicKey().toPublicKeyString();

    ChainStore.init().then(() => {

        let tr = new TransactionBuilder();
        let nonce = TransactionHelper.unique_nonce_uint64();
        let request_id = hash.sha256(pubKey + nonce).toString('hex');

        // let request_id = "04856f2c062af25803faafc4a061e2a3961dda45a94ab3af0e67a4f7794b399a33";

        tr.add_type_operation('data_transaction_create', {
            request_id: request_id,
            product_id: "1.17.0",
            version: "1.0.0",
            params: "params",
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            requester: "1.2.19",
            create_date_time: new Date().toISOString().split('.')[0]
        });

        tr.set_required_fees().then(() => {
            tr.add_signer(pKey);
            console.log("serialized transaction:", JSON.stringify(tr.serialize(),null,'\t'));
            ChainStore.subscribe(function (obj) {
                console.log(obj);
            })
            tr.broadcast(function (result) {
                console.log('result:',result);
            }).catch((ex)=>{
                let balance = /Insufficient Balance/.test(ex.message);
            });
        }, (ex)=> {
            console.error(ex);
        })

    },(ex)=> {
        console.error(ex);
    });
},(ex)=> {
    console.error(ex);
});
