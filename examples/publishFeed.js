import {Apis} from "bitsharesjs-ws";
import {TransactionBuilder, PrivateKey} from "../lib";

const wifKey = "5KBuq5WmHvgePmB7w3onYsqLM8ESomM2Ae7SigYuuwg8MDHW7NN";
const pKey = PrivateKey.fromWif(wifKey);

Apis.instance("wss://node.testnet.bitshares.eu", true).init_promise.then(
    res => {
        console.log("connected to:", res[0].network_name, "network");
        let tr = new TransactionBuilder();
        tr.add_type_operation("asset_publish_feed", {
            publisher: "1.2.680",
            asset_id: "1.3.1003",
            feed: {
                settlement_price: {
                    quote: {
                        amount: 10,
                        asset_id: "1.3.0"
                    },
                    base: {
                        amount: 5,
                        asset_id: "1.3.1003"
                    }
                },
                maintenance_collateral_ratio: 1750,
                maximum_short_squeeze_ratio: 1200,
                core_exchange_rate: {
                    quote: {
                        amount: 10,
                        asset_id: "1.3.0"
                    },
                    base: {
                        amount: 5,
                        asset_id: "1.3.1003"
                    }
                }
            }
        });

        tr.set_required_fees().then(() => {
            tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
            console.log("serialized transaction:", tr.serialize().operations);
            tr
                .broadcast()
                .then(() => {
                    console.log("Publish feed success!");
                })
                .catch(err => {
                    console.error(err);
                });
        });
    }
);
