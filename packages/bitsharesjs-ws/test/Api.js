import assert from "assert";
import {Apis} from "../lib";

var coreAsset;
var default_api = "wss://eu.openledger.info/ws";

describe("Api", () => {
    let cs = default_api;

    describe("Subscriptions", function() {
        beforeEach(function() {
            return Apis.instance(cs, true)
                .init_promise.then(function(result) {
                    coreAsset = result[0].network.core_asset;
                })
                .catch(() => {});
        });

        afterEach(function() {
            return new Promise(function(res) {
                Apis.close().then(res);
            });
        });

        it("Set subscribe callback", function() {
            return new Promise(function(resolve) {
                Apis.instance()
                    .db_api()
                    .exec("set_subscribe_callback", [callback, true])
                    .then(function(sub) {
                        if (sub === null) {
                            resolve();
                        } else {
                            reject(new Error("Expected sub to equal null"));
                        }
                    });

                function callback(obj) {
                    console.log("callback obj:", obj);
                    resolve();
                }
            });
        });

        it("Market subscription", function() {
            return new Promise(function(resolve) {
                Apis.instance()
                    .db_api()
                    .exec("subscribe_to_market", [callback, "1.3.0", "1.3.19"])
                    .then(function(sub) {
                        if (sub === null) {
                            resolve();
                        } else {
                            reject(new Error("Expected sub to equal null"));
                        }
                    });

                function callback() {
                    resolve();
                }
            });
        });

        it("Market unsubscribe", function() {
            this.timeout(10000);
            return new Promise(function(resolve) {
                Apis.instance()
                    .db_api()
                    .exec("subscribe_to_market", [callback, "1.3.0", "1.3.19"])
                    .then(function() {
                        Apis.instance()
                            .db_api()
                            .exec("unsubscribe_from_market", [
                                callback,
                                "1.3.0",
                                "1.3.19"
                            ])
                            .then(function(unsub) {
                                if (unsub === null) {
                                    resolve();
                                } else {
                                    reject(
                                        new Error(
                                            "Expected unsub to equal null"
                                        )
                                    );
                                }
                            });
                    });

                function callback() {
                    resolve();
                }
            });
        });
    });

    describe("Database API", function() {
        // Connect once for all tests
        before(function() {
            return Apis.instance(cs, true).init_promise.then(function(result) {
                coreAsset = result[0].network.core_asset;
            });
        });

        after(function() {
            return new Promise(function(res) {
                Apis.close().then(res);
            });
        });

        it("Get object", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("get_objects", [["2.0.0"]])
                    .then(function(objects) {
                        if (objects[0].id === "2.0.0") {
                            resolve();
                        } else {
                            reject(new Error("Expected object with id 2.0.0"));
                        }
                    });
            });
        });

        it("Get object (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db.get_objects(["2.0.0"]).then(function(objects) {
                    if (objects[0].id === "2.0.0") {
                        resolve();
                    } else {
                        reject(new Error("Expected object with id 2.0.0"));
                    }
                });
            });
        });

        it("Get account by name", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("get_account_by_name", ["committee-account"])
                    .then(function(account) {
                        if (
                            account.id === "1.2.0" &&
                            account.name === "committee-account"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected object with id 1.2.0 and name committee-account"
                                )
                            );
                        }
                    });
            });
        });

        it("Get account by name (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db
                    .get_account_by_name("committee-account")
                    .then(function(account) {
                        if (
                            account.id === "1.2.0" &&
                            account.name === "committee-account"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected object with id 1.2.0 and name committee-account"
                                )
                            );
                        }
                    });
            });
        });

        it("Get block", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("get_block", [1])
                    .then(function(block) {
                        if (
                            block.previous ===
                            "0000000000000000000000000000000000000000"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected block with previous value of 0000000000000000000000000000000000000000"
                                )
                            );
                        }
                    });
            });
        });

        it("Get block (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db.get_block(1).then(function(block) {
                    if (
                        block.previous ===
                        "0000000000000000000000000000000000000000"
                    ) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                "Expected block with previous value of 0000000000000000000000000000000000000000"
                            )
                        );
                    }
                });
            });
        });

        it("Get full accounts", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("get_full_accounts", [
                        ["committee-account", "1.2.0"],
                        true
                    ])
                    .then(function(accounts) {
                        let byName = accounts[0][1];
                        let byId = accounts[1][1];
                        if (
                            byName.account.id === "1.2.0" &&
                            byId.account.name === "committee-account"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected objects with id 1.2.0 and name committee-account"
                                )
                            );
                        }
                    });
            });
        });

        it("Get full accounts (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db
                    .get_full_accounts(["committee-account", "1.2.0"], true)
                    .then(function(accounts) {
                        let byName = accounts[0][1];
                        let byId = accounts[1][1];
                        if (
                            byName.account.id === "1.2.0" &&
                            byId.account.name === "committee-account"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected objects with id 1.2.0 and name committee-account"
                                )
                            );
                        }
                    });
            });
        });

        it("Lookup assets by symbol", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("lookup_asset_symbols", [[coreAsset, coreAsset]])
                    .then(function(assets) {
                        if (
                            assets[0].symbol === coreAsset &&
                            assets[1].symbol === coreAsset
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected assets with symbol " + coreAsset
                                )
                            );
                        }
                    });
            });
        });

        it("Lookup assets by symbol (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db
                    .lookup_asset_symbols([coreAsset, coreAsset])
                    .then(function(assets) {
                        if (
                            assets[0].symbol === coreAsset &&
                            assets[1].symbol === coreAsset
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected assets with symbol " + coreAsset
                                )
                            );
                        }
                    });
            });
        });

        it("List assets", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .db_api()
                    .exec("list_assets", ["A", 5])
                    .then(function(assets) {
                        if (assets.length > 0) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected assets with symbol " + coreAsset
                                )
                            );
                        }
                    });
            });
        });

        it("List assets (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.db.list_assets("A", 5).then(function(assets) {
                    if (assets.length > 0) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                "Expected assets with symbol " + coreAsset
                            )
                        );
                    }
                });
            });
        });
    });

    describe("History API", function() {
        // Connect once for all tests
        before(function() {
            return Apis.instance(cs, true).init_promise.then(function(result) {
                coreAsset = result[0].network.core_asset;
            });
        });

        after(function() {
            return new Promise(function(res) {
                Apis.close().then(res);
            });
        });

        it("Get market data", function() {
            return new Promise(function(resolve, reject) {
                if (coreAsset !== "BTS") {
                    reject(
                        new Error(
                            "This test will only work when connected to a BTS api"
                        )
                    );
                }
                Apis.instance()
                    .history_api()
                    .exec("get_fill_order_history", ["1.3.121", "1.3.0", 10])
                    .then(function(history) {
                        if (history.length > 0) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected market history of at least one entry"
                                )
                            );
                        }
                    });
            });
        });

        it("Get market data (short)", function() {
            return new Promise(function(resolve, reject) {
                if (coreAsset !== "BTS") {
                    reject(
                        new Error(
                            "This test will only work when connected to a BTS api"
                        )
                    );
                }
                Apis.history
                    .get_fill_order_history("1.3.121", "1.3.0", 10)
                    .then(function(history) {
                        if (history.length > 0) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Expected market history of at least one entry"
                                )
                            );
                        }
                    });
            });
        });
    });

    describe("Crypto API", function() {
        // Connect once for all tests
        before(function() {
            return Apis.instance(cs, true, 5000, {
                enableCrypto: true
            }).init_promise.then(function(result) {
                coreAsset = result[0].network.core_asset;
            });
        });

        after(function() {
            return new Promise(function(res) {
                Apis.close().then(res);
            });
        });

        it("Initializes the crypto api", function() {
            assert(!!Apis.instance().crypto_api());
        });

        it("Initializes the crypto api (short)", function() {
            assert(!!Apis.crypto);
        });
    });

    describe("Orders API", function() {
        // Connect once for all tests
        before(function() {
            return Apis.instance(cs, true, 5000, {
                enableOrders: true
            }).init_promise.then(function(result) {
                coreAsset = result[0].network.core_asset;
            });
        });

        after(function() {
            return new Promise(function(res) {
                Apis.close().then(res);
            });
        });

        it("Initializes the orders api", function() {
            assert(!!Apis.instance().orders_api());
        });

        it("Initializes the orders api (short)", function() {
            assert(!!Apis.orders);
        });

        it("Get tracked groups config", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .orders_api()
                    .exec("get_tracked_groups", [])
                    .then(function(trackedGroups) {
                        if (trackedGroups.length > 0) {
                            resolve();
                        } else {
                            reject(new Error("Get tracked groups error"));
                        }
                    })
                    .catch(err => {
                        reject(err);
                    });
            });
        });

        it("Get tracked groups config (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.orders
                    .get_tracked_groups()
                    .then(function(trackedGroups) {
                        if (trackedGroups.length > 0) {
                            resolve();
                        } else {
                            reject(new Error("Get tracked groups error"));
                        }
                    })
                    .catch(err => {
                        reject(err);
                    });
            });
        });

        it("Get ordered groups", function() {
            return new Promise(function(resolve, reject) {
                Apis.instance()
                    .orders_api()
                    .exec("get_grouped_limit_orders", [
                        "1.3.113",
                        "1.3.0",
                        10,
                        null,
                        1
                    ])
                    .then(function(groups) {
                        if (groups.length > 0) {
                            resolve();
                        } else {
                            reject(new Error("Get groups error"));
                        }
                    })
                    .catch(err => {
                        reject(err);
                    });
            });
        });

        it("Get ordered groups (short)", function() {
            return new Promise(function(resolve, reject) {
                Apis.orders
                    .get_grouped_limit_orders("1.3.113", "1.3.0", 10, null, 1)
                    .then(function(groups) {
                        if (groups.length > 0) {
                            resolve();
                        } else {
                            reject(new Error("Get groups error"));
                        }
                    })
                    .catch(err => {
                        reject(err);
                    });
            });
        });
    });
});
