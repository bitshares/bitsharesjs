import assert from "assert";
import {Apis} from "bitsharesjs-ws";
import { TransactionBuilder } from "../../lib";


describe("ChainStore", () => {
    // Connect once for all tests
    before(function() {
        /* use wss://bitshares.openledger.info/ws if no local node is available */
        return Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then(function() {
        });
    });

    it("Transfer", () => {
        let tr = new TransactionBuilder();

        assert.doesNotThrow(function() {
            tr.add_type_operation( "transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: { amount: 50000, asset_id: "1.3.0" },
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });
        }, "This transfer should not throw");
    });

    it("Sets core required fees", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();
            tr.add_type_operation( "transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: { amount: 50000, asset_id: "1.3.0" },
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.set_required_fees().then(() => {
                assert.equal(tr.operations[0][1].fee.asset_id, "1.3.0");
                assert(tr.operations[0][1].fee.amount > 0);
                resolve();
            }).catch(reject);
        });
    });

    it("Sets required fees", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();
            tr.add_type_operation( "transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.121"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: { amount: 50000, asset_id: "1.3.0" },
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.set_required_fees().then(() => {
                assert.equal(tr.operations[0][1].fee.asset_id, "1.3.121");
                assert(tr.operations[0][1].fee.amount > 0);
                resolve();
            }).catch(reject);
        });
    });

    it("Asset create standard", () => {
        let tr = new TransactionBuilder();
        let operationJSON = {
            "fee": {
                amount: 0,
                asset_id: 0
            },
            "issuer": "1.2.1",
            "symbol": "TESTTEST",
            "precision": 5,
            "common_options": {
                "max_supply": "10000000000",
                "market_fee_percent": 0,
                "max_market_fee": "0",
                "issuer_permissions": 79,
                "flags": 0,
                "core_exchange_rate": {
                    "base": {
                        "amount": 100000,
                        "asset_id": "1.3.0"
                    },
                    "quote": {
                        "amount": 100000,
                        "asset_id": "1.3.1"
                    }
                },
                "whitelist_authorities": [

                ],
                "blacklist_authorities": [

                ],
                "whitelist_markets": [

                ],
                "blacklist_markets": [

                ],
                "description": JSON.stringify({main: "", market: ""}),
                "extensions": null
            },
            "is_prediction_market": false,
            "extensions": null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation( "asset_create", operationJSON);
        });
    });

    it("Asset create prediction market", () => {
        let tr = new TransactionBuilder();
        let operationJSON = {
            "fee": {
                amount: 0,
                asset_id: 0
            },
            "issuer": "1.2.1",
            "symbol": "TESTTEST",
            "precision": 5,
            "common_options": {
                "max_supply": "10000000000",
                "market_fee_percent": 2,
                "max_market_fee": "500",
                "issuer_permissions": 79,
                "flags": 0,
                "core_exchange_rate": {
                    "base": {
                        "amount": 100000,
                        "asset_id": "1.3.0"
                    },
                    "quote": {
                        "amount": 100000,
                        "asset_id": "1.3.1"
                    }
                },
                "whitelist_authorities": [

                ],
                "blacklist_authorities": [

                ],
                "whitelist_markets": [

                ],
                "blacklist_markets": [

                ],
                "description": JSON.stringify({main: "", market: ""}),
                "extensions": null
            },
            bitasset_opts: {
                feed_lifetime_sec: 864000,
                force_settlement_delay_sec: 86400,
                force_settlement_offset_percent: 100,
                maximum_force_settlement_volume: 500,
                minimum_feeds: 7,
                short_backing_asset: "1.3.0"
            },
            "is_prediction_market": true,
            "extensions": null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation( "asset_create", operationJSON);
        });
    });
});
