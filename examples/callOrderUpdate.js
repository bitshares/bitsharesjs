import {Apis} from "bitsharesjs-ws";
import {TransactionBuilder, PrivateKey} from "../lib";

const wifKey = "5KBuq5WmHvgePmB7w3onYsqLM8ESomM2Ae7SigYuuwg8MDHW7NN";
const pKey = PrivateKey.fromWif(wifKey);

Apis.instance("wss://node.testnet.bitshares.eu", true).init_promise.then(
    res => {
        console.log("connected to:", res[0].network_name, "network");

        let tr = new TransactionBuilder();
        tr.add_type_operation("call_order_update", {
            funding_account: "1.2.680",
            delta_collateral: {
                amount: 1000000,
                asset_id: "1.3.0"
            },
            delta_debt: {
                amount: 0,
                asset_id: "1.3.1003"
            },
            extensions: {
                target_collateral_ratio: 250
            }
        });

        tr.set_required_fees().then(() => {
            tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
            console.log("serialized transaction:", tr.serialize().operations);
            tr
                .broadcast()
                .then(() => {
                    console.log("Call order update success!");
                })
                .catch(err => {
                    console.error(err);
                });
        });
    }
);
