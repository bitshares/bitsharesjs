import assert from "assert";
import {Apis} from "bitsharesjs-ws";
import {TransactionBuilder, ops, hash} from "../../lib";

describe("TransactionBuilder", () => {
    // Connect once for all tests
    before(function() {
        return new Promise(function(resolve, reject) {
            Apis.instance("wss://eu.nodes.bitshares.ws", true)
                .init_promise.then(resolve)
                .catch(reject);
        });
    });

    after(function() {
        return new Promise(function(resolve) {
            Apis.close().then(resolve);
        });
    });

    it("Preload Transaction Signer", () => {
        var tx = {
            expiration: "2019-05-02T11:05:25",
            extensions: [],
            operations: [
                [
                    0,
                    {
                        amount: {
                            amount: 100000,
                            asset_id: "1.3.0"
                        },
                        extensions: [],
                        fee: {
                            amount: 45468,
                            asset_id: "1.3.0"
                        },
                        from: "1.2.100",
                        to: "1.2.90742"
                    }
                ]
            ],
            ref_block_num: 58580,
            ref_block_prefix: 2618414547,
            signatures: [
                "20214e0193c3b54e0c16349b2b7230f9bb83af9cb3ac7a28b2e5f292f425ad67582fa640cff74c9f702f6740cdb2f54269a7ea1419d58a20405deda1306f1d3fc8"
            ]
        };
        let tr = new TransactionBuilder(tx);

        assert.equal(tr.expiration, tx.expiration);
        assert.equal(tr.signatures, tx.signatures);
        assert.equal(tr.ref_block_num, tx.ref_block_num);
        assert.equal(tr.ref_block_prefix, tx.ref_block_prefix);
        assert.equal(tr.operations.length, tx.operations.length);
        assert.equal(tr.operations[0][0], tx.operations[0][0]);
        assert.equal(tr.operations[0][1], tx.operations[0][1]);
    });

    it("Transfer", () => {
        let tr = new TransactionBuilder();

        assert.doesNotThrow(function() {
            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
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
            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.0");
                    assert(tr.operations[0][1].fee.amount > 0);
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Sets required fees", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();
            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.121"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.121");
                    assert(tr.operations[0][1].fee.amount > 0);
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Defaults to CORE when fee pool is empty", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();
            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.125" // The fee pool of this asset must be empty or insufficient
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.0");
                    assert(tr.operations[0][1].fee.amount > 0);
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Sets and checks required fees for each op", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();
            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.121"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.113"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.113"
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.add_type_operation("transfer", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.125" // The fee pool of this asset must be empty or insufficient
                },
                from: "1.2.1",
                to: "1.2.2",
                amount: {amount: 50000, asset_id: "1.3.0"},
                memo: {
                    from: "BTS1111111111111111111111111111111114T1Anm",
                    to: "BTS1111111111111111111111111111111114T1Anm",
                    nonce: 0,
                    message: ""
                }
            });

            tr.add_type_operation("account_upgrade", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.121"
                },
                account_to_upgrade: "1.2.1",
                upgrade_to_lifetime_member: true
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.121");
                    assert.equal(tr.operations[1][1].fee.asset_id, "1.3.113");
                    assert.equal(tr.operations[2][1].fee.asset_id, "1.3.113");
                    assert.equal(tr.operations[3][1].fee.asset_id, "1.3.0");
                    assert.equal(tr.operations[4][1].fee.asset_id, "1.3.121");
                    assert(
                        tr.operations[4][1].fee.amount >
                            tr.operations[0][1].fee.amount
                    );
                    assert(tr.operations[0][1].fee.amount > 0);
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Sets non-zero fee for proposed operations", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();

            let proposal = {
                op: tr.get_type_operation("transfer", {
                    fee: {
                        amount: 0,
                        asset_id: "1.3.0"
                    },
                    from: "1.2.1057595",
                    to: "1.2.802379",
                    amount: {amount: 100000, asset_id: "1.3.0"},
                    memo: {
                        from: "BTS1111111111111111111111111111111114T1Anm",
                        to: "BTS1111111111111111111111111111111114T1Anm",
                        nonce: 0,
                        message: ""
                    }
                })
            };

            let proposed_ops = [proposal];

            tr.add_type_operation("proposal_create", {
                proposed_ops,
                fee_paying_account: "1.2.1",
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                }
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(
                        tr.operations[0][1].proposed_ops[0].op[1].fee.asset_id,
                        "1.3.0"
                    );
                    assert(
                        tr.operations[0][1].proposed_ops[0].op[1].fee.amount > 0
                    );
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Resolves fees for multiple proposed operations", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();

            let proposed_ops = [];
            let proposal_fee_assets = ["1.3.121", "1.3.125", "1.3.111"];
            proposal_fee_assets.forEach(fee_asset => {
                proposed_ops.push({
                    op: tr.get_type_operation("transfer", {
                        fee: {
                            amount: 0,
                            asset_id: fee_asset
                        },
                        from: "1.2.1",
                        to: "1.2.2",
                        amount: {amount: 50000, asset_id: "1.3.0"},
                        memo: {
                            from: "BTS1111111111111111111111111111111114T1Anm",
                            to: "BTS1111111111111111111111111111111114T1Anm",
                            nonce: 0,
                            message: ""
                        }
                    })
                });
            });
            tr.add_type_operation("proposal_create", {
                proposed_ops,
                fee_paying_account: "1.2.1",
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                }
            });

            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.0");

                    /*
                    * This test might break as fee pools are replenished, check and
                    * update assets used if necessary. At least one asset should
                    * have an insufficient pool balance, and one should have a
                    * sufficient pool balance. The current iteration assumes the
                    * asset 1.3.125 has an insufficient fee pool balance
                    */
                    tr.operations[0][1].proposed_ops.forEach((prop, index) => {
                        if (index === 1)
                            // asset "1.3.125 with insufficient fee pool balance"
                            assert.equal(prop.op[1].fee.asset_id, "1.3.0");
                        else {
                            assert.equal(
                                prop.op[1].fee.asset_id,
                                proposal_fee_assets[index]
                            );
                        }
                        /* All ops should have a non-zero fee assigned */
                        assert(prop.op[1].fee.amount > 0);
                    });
                    resolve();
                })
                .catch(reject);
        });
    });

    // it("Benefits from pruning identical transactions", function() {
    //     this.timeout(5000);
    //     function addOperations(tr, count) {
    //         for (var i = 0; i < count; i++) {
    //             tr.add_type_operation("transfer", {
    //                 fee: {
    //                     amount: 0,
    //                     asset_id: "1.3.0" // + (111 + i)
    //                 },
    //                 from: "1.2.1",
    //                 to: "1.2.2",
    //                 amount: {amount: 50000, asset_id: "1.3.0"},
    //                 memo: {
    //                     from: "BTS1111111111111111111111111111111114T1Anm",
    //                     to: "BTS1111111111111111111111111111111114T1Anm",
    //                     nonce: 0,
    //                     message: ""
    //                 }
    //             });
    //         }
    //     }
    //     return new Promise((resolve, reject) => {
    //         const opCount = 250;
    //         let tr = new TransactionBuilder();
    //         addOperations(tr, opCount);
    //         let start = new Date().getTime();
    //         tr
    //             .set_required_fees() // Set fees with no pruning of identical transactions
    //             .then(() => {
    //                 let noPruneTime = new Date().getTime() - start;
    //
    //                 let tr2 = new TransactionBuilder();
    //                 addOperations(tr2, opCount);
    //                 start = new Date().getTime();
    //                 tr2.set_required_fees(undefined, true).then(() => {
    //                     let pruneTime = new Date().getTime() - start;
    //                     for (var i = 0; i < tr.operations.length; i++) {
    //                         assert.equal(
    //                             tr.operations[i][1].fee.asset_id,
    //                             tr2.operations[i][1].fee.asset_id
    //                         );
    //                     }
    //                     assert(pruneTime < noPruneTime);
    //                     resolve();
    //                 });
    //             })
    //             .catch(reject);
    //     });
    // });

    it("Asset create standard", () => {
        let tr = new TransactionBuilder();
        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            issuer: "1.2.1",
            symbol: "TESTTEST",
            precision: 5,
            common_options: {
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
                        asset_id: "1.3.1"
                    }
                },
                whitelist_authorities: [],
                blacklist_authorities: [],
                whitelist_markets: [],
                blacklist_markets: [],
                description: JSON.stringify({main: "", market: ""}),
                extensions: {}
            },
            is_prediction_market: false,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("asset_create", operationJSON);
        });
    });

    it("Htlc create", () => {
        let tr = new TransactionBuilder();

        let preimageValue = "My preimage value";
        let preimage_hash_calculated = hash.sha256(preimageValue);

        let operationJSON = {
            from: "1.2.680",
            to: "1.2.17",
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            amount: {
                amount: 1,
                asset_id: "1.3.0"
            },
            preimage_hash: [1, preimage_hash_calculated],
            preimage_size: preimageValue.length,
            claim_period_seconds: 86400
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("htlc_create", operationJSON);
        });
    });

    it("Htlc redeem", () => {
        let tr = new TransactionBuilder();
        let preimageValue = "My preimage value";

        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            htlc_id: "1.16.1",
            redeemer: "1.2.283",
            preimage: preimageValue,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("htlc_redeem", operationJSON);
        });
    });

    it("Htlc extend", () => {
        let tr = new TransactionBuilder();

        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            htlc_id: "1.16.1",
            update_issuer: "1.2.283",
            seconds_to_add: 60,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("htlc_extend", operationJSON);
        });
    });

    it("Asset create prediction market", () => {
        let tr = new TransactionBuilder();
        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            issuer: "1.2.1",
            symbol: "TESTTEST",
            precision: 5,
            common_options: {
                max_supply: "10000000000",
                market_fee_percent: 2,
                max_market_fee: "500",
                issuer_permissions: 79,
                flags: 0,
                core_exchange_rate: {
                    base: {
                        amount: 100000,
                        asset_id: "1.3.0"
                    },
                    quote: {
                        amount: 100000,
                        asset_id: "1.3.1"
                    }
                },
                whitelist_authorities: [],
                blacklist_authorities: [],
                whitelist_markets: [],
                blacklist_markets: [],
                description: JSON.stringify({main: "", market: ""}),
                extensions: {}
            },
            bitasset_opts: {
                feed_lifetime_sec: 864000,
                force_settlement_delay_sec: 86400,
                force_settlement_offset_percent: 100,
                maximum_force_settlement_volume: 500,
                minimum_feeds: 7,
                short_backing_asset: "1.3.0"
            },
            is_prediction_market: true,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("asset_create", operationJSON);
        });
    });

    it("Asset create with extension", () => {
        let tr = new TransactionBuilder();
        let operationJSON = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            issuer: "1.2.1",
            symbol: "TESTTEST",
            precision: 5,
            common_options: {
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
                        asset_id: "1.3.1"
                    }
                },
                whitelist_authorities: [],
                blacklist_authorities: [],
                whitelist_markets: [],
                blacklist_markets: [],
                description: JSON.stringify({main: "", market: ""}),
                extensions: {
                    reward_percent: 100, // 1 percent
                    whitelist_market_fee_sharing: ["1.2.680", "1.2.679"]
                }
            },
            is_prediction_market: false,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("asset_create", operationJSON);
        });
    });
});
