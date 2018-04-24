import assert from "assert";
import {Apis} from "bitsharesjs-ws";
import {TransactionBuilder} from "../../lib";

describe("TransactionBuilder", () => {
    // Connect once for all tests
    before(function() {
        /* use wss://bitshares.openledger.info/ws if no local node is available */
        return new Promise(function(resolve, reject) {
            Apis.instance("wss://bitshares.openledger.info/ws", true)
                .init_promise.then(resolve)
                .catch(reject);
        });
    });

    after(function() {
        return new Promise(function(resolve) {
            Apis.close().then(resolve);
        });
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
                    asset_id: "1.3.111" // The fee pool of this asset must be empty or insufficient
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
                    asset_id: "1.3.111" // The fee pool of this asset must be empty or insufficient
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

    it("Resolves fees for proposed operations", () => {
        return new Promise((resolve, reject) => {
            let tr = new TransactionBuilder();

            let proposed_ops = [];
            for (var i = 0; i < 5; i++) {
                proposed_ops.push({
                    op: tr.get_type_operation("transfer", {
                        fee: {
                            amount: 0,
                            asset_id: "1.3." + (111 + i)
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
            }
            tr.add_type_operation("proposal_create", {
                proposed_ops,
                fee_paying_account: "1.2.1",
                fee: {
                    amount: 0,
                    asset_id: "1.3.121"
                }
            });

            tr.add_type_operation("account_upgrade", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.113"
                },
                account_to_upgrade: "1.2.1",
                upgrade_to_lifetime_member: true
            });

            //
            tr
                .set_required_fees()
                .then(() => {
                    assert.equal(tr.operations[0][1].fee.asset_id, "1.3.121");
                    assert.equal(tr.operations[1][1].fee.asset_id, "1.3.113");
                    assert(
                        tr.operations[0][1].fee.amount <
                            tr.operations[1][1].fee.amount
                    );
                    /*
                * This test might break as fee pools are replenished, check and
                * update assets used if necessary. At least one asset should
                * have an insufficient pool balance, and one should have a
                * sufficient pool balance
                */
                    tr.operations[0][1].proposed_ops.forEach((prop, index) => {
                        if (index === 2)
                            assert.equal(prop.op[1].fee.asset_id, "1.3.113");
                        else assert.equal(prop.op[1].fee.asset_id, "1.3.0");
                    });
                    resolve();
                })
                .catch(reject);
        });
    });

    it("Benefits from pruning identical transactions", function() {
        this.timeout(5000);
        function addOperations(tr, count) {
            for (var i = 0; i < count; i++) {
                tr.add_type_operation("transfer", {
                    fee: {
                        amount: 0,
                        asset_id: "1.3.0" // + (111 + i)
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
            }
        }
        return new Promise((resolve, reject) => {
            const opCount = 250;
            let tr = new TransactionBuilder();
            addOperations(tr, opCount);
            let start = new Date().getTime();
            tr
                .set_required_fees() // Set fees with no pruning of identical transactions
                .then(() => {
                    let noPruneTime = new Date().getTime() - start;

                    let tr2 = new TransactionBuilder();
                    addOperations(tr2, opCount);
                    start = new Date().getTime();
                    tr2.set_required_fees(undefined, true).then(() => {
                        let pruneTime = new Date().getTime() - start;
                        for (var i = 0; i < tr.operations.length; i++) {
                            assert.equal(
                                tr.operations[i][1].fee.asset_id,
                                tr2.operations[i][1].fee.asset_id
                            );
                        }
                        assert(pruneTime < noPruneTime);
                        resolve();
                    });
                })
                .catch(reject);
        });
    });

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
                extensions: null
            },
            is_prediction_market: false,
            extensions: null
        };

        assert.doesNotThrow(function() {
            tr.add_type_operation("asset_create", operationJSON);
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
                extensions: null
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
});
