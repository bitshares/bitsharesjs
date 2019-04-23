import {Apis} from "bitsharesjs-ws";
import {
    TransactionBuilder,
    ChainStore,
    FetchChain,
    PrivateKey,
    hash
} from "../lib";

const wifKey = "5KToX58VNggTcfKrWswvEfSSR8dKCzkybB7No7j4WmVcCMxbNvU";
const pKey = PrivateKey.fromWif(wifKey);

Apis.instance("wss://node.testnet.bitshares.eu", true).init_promise.then(
    res => {
        console.log("connected to:", res[0].network_name, "network");

        ChainStore.init().then(() => {
            let fromAccount = "thtlc-2";
            let toAccount = "thtlc-3";

            Promise.all([
                FetchChain("getAccount", fromAccount),
                FetchChain("getAccount", toAccount)
            ]).then(res => {
                let [fromAccount, toAccount] = res;

                let tr = new TransactionBuilder();

                let preimageValue = "My preimage value";
                let preimage_hash_calculated = hash.sha256(preimageValue);

                let operationJSON = {
                    from: fromAccount.get("id"),
                    to: toAccount.get("id"),
                    fee: {
                        amount: 0,
                        asset_id: "1.3.0"
                    },
                    amount: {
                        amount: 5000000,
                        asset_id: "1.3.0"
                    },
                    preimage_hash: [2, preimage_hash_calculated],
                    preimage_size: preimageValue.length,
                    claim_period_seconds: 86400
                };

                tr.add_type_operation("htlc_create", operationJSON);

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
                                "hltc was succesfully created!" +
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
