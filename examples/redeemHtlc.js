import {Apis} from "bitsharesjs-ws";
import {
    TransactionBuilder,
    ChainStore,
    FetchChain,
    PrivateKey,
    hash
} from "../lib";

const wifKey = "5JjjMBUHUecV8nHvgKXdjRi9oqD8h382qQrAEAdLQ4oYAoEeSv2";
const pKey = PrivateKey.fromWif(wifKey);

Apis.instance("wss://node.testnet.bitshares.eu", true).init_promise.then(
    res => {
        console.log("connected to:", res[0].network_name, "network");

        ChainStore.init().then(() => {
            let toAccount = "thtlc-3";

            Promise.all([FetchChain("getAccount", toAccount)]).then(res => {
                let [toAccount] = res;

                let tr = new TransactionBuilder();

                let preimageValue = "My preimage value";

                let operationJSON = {
                    preimage: preimageValue,
                    fee: {
                        amount: 0,
                        asset_id: "1.3.0"
                    },
                    htlc_id: "1.16.40",
                    redeemer: toAccount.get("id"),
                    extensions: null
                };

                console.log("tx prior serialization ", operationJSON);

                tr.add_type_operation("htlc_redeem", operationJSON);

                tr.set_required_fees().then(() => {
                    tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
                    console.log(
                        "serialized transaction:",
                        tr.serialize().operations
                    );
                    tr
                        .broadcast()
                        .then(result => {
                            console.log(
                                "hltc was succesfully redeeemed!" +
                                    JSON.stringify(result)
                            );
                        })
                        .catch(err => {
                            console.error(err);
                        });
                });
            });
        });
    }
);
