import {Apis} from "bitsharesjs-ws";
import {
    TransactionBuilder,
    ChainStore,
    FetchChain,
    PrivateKey,
    hash
} from "../lib";

const wifKey = "5Jmg51xtQckCpiSreThXBAs8vfrtKVJw57G5LaMDUUg2qQMwX1G";
const pKey = PrivateKey.fromWif(wifKey);

Apis.instance("wss://node.testnet.bitshares.eu", true).init_promise.then(
    res => {
        console.log("connected to:", res[0].network_name, "network");

        ChainStore.init().then(() => {
            let tr = new TransactionBuilder();

            let operationJSON = {
                issuer: "1.2.24913",
                asset_to_update: "1.3.1424",
                new_options: {
                    max_supply: "10000000000",
                    market_fee_percent: 0,
                    max_market_fee: "0",
                    issuer_permissions: 79,
                    flags: 0,
                    core_exchange_rate: {
                        base: {
                            amount: 100000,
                            asset_id: "1.3.0"
                        },
                        quote: {
                            amount: 100000,
                            asset_id: "1.3.1424"
                        }
                    },
                    whitelist_authorities: [],
                    blacklist_authorities: [],
                    whitelist_markets: [],
                    blacklist_markets: [],
                    description: JSON.stringify({
                        main: "new description",
                        market: ""
                    }),
                    extensions: {
                        reward_percent: 10000,
                        whitelist_market_fee_sharing: [
                            "1.2.24913",
                            "1.2.982379739"
                        ]
                    }
                },
                is_prediction_market: false,
                extensions: null
            };

            tr.add_type_operation("asset_update", operationJSON);

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
                            "asset was succesfully updated. result raw tx: \n" +
                                JSON.stringify(result)
                        );
                    })
                    .catch(err => {
                        console.error(err);
                    });
            });
        });
    }
);
