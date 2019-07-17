import assert from "assert";
import {Apis, ChainConfig} from "bitsharesjs-ws";
import {ChainStore} from "../../lib";
// var objs = require("./testObjects.json");

var coreAsset;

describe("ChainStore", () => {
    // Connect once for all tests
    before(function() {
        return Apis.instance(
            "wss://eu.nodes.bitshares.ws",
            true
        ).init_promise.then(function(result) {
            coreAsset = result[0].network.core_asset;
            return ChainStore.init();
        });
    });

    // Unsubscribe everything after each test
    afterEach(function() {
        ChainStore.subscribers = new Set();
        ChainStore.clearCache();
    });

    after(function() {
        return new Promise(function(resolve) {
            ChainConfig.reset();
            ChainStore.clearCache();
            ChainStore.subscribers.clear();
            Apis.close().then(resolve);
        });
    });

    it("Asset not found", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAsset(coreAsset) !== undefined) {
                    assert(ChainStore.getAsset("NOTFOUND") === null);
                    resolve();
                }
            });
            assert(ChainStore.getAsset("NOTFOUND") === undefined);
        });
    });

    it("Asset by name", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAsset(coreAsset) !== undefined) {
                    assert(ChainStore.getAsset(coreAsset) != null);
                    resolve();
                }
            });
            assert(ChainStore.getAsset(coreAsset) === undefined);
        });
    });

    it("Asset by id", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAsset("1.3.121") !== undefined) {
                    assert(ChainStore.getAsset("1.3.121") != null);
                    resolve();
                }
            });
            assert(ChainStore.getAsset("1.3.0") === undefined);
        });
    });

    it("Object by id", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getObject("2.0.0") !== undefined) {
                    assert(ChainStore.getObject("2.0.0") != null);
                    resolve();
                }
            });
            assert(ChainStore.getObject("2.0.0") === undefined);
        });
    });

    it("Objects by vote id", function() {
        const voteIds = ["1:26", "0:82"];
        let interval;
        return new Promise(function(resolve) {
            interval = setInterval(function() {
                let objects = ChainStore.getObjectsByVoteIds(voteIds);
                if (objects.length && !!objects[0]) {
                    assert(objects.length === voteIds.length);
                    assert(!!objects[0]);
                    assert(!!objects[1]);
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
            let objects = ChainStore.getObjectsByVoteIds(voteIds);
            assert(objects.length === voteIds.length);
            assert(objects[0] === null);
            assert(objects[1] === null);
        });
    });

    it("Account by id", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAccount("1.2.0") !== undefined) {
                    assert(ChainStore.getAccount("1.2.0") != null);
                    resolve();
                }
            });
            assert(ChainStore.getAccount("1.2.0") === undefined);
        });
    });

    it("Account by name", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAccount("proxy-to-self") !== undefined) {
                    assert(ChainStore.getAccount("proxy-to-self") != null);
                    resolve();
                }
            });
            assert(ChainStore.getAccount("proxy-to-self") === undefined);
        });
    });

    it("Full Account", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAccount("1.2.0") !== undefined) {
                    assert(ChainStore.getAccount("1.2.0") != null);
                    resolve();
                }
            });
            assert(ChainStore.getAccount("1.2.0") === undefined);
        });
    });

    it("Account name by id", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                if (ChainStore.getAccountName("1.2.0") !== undefined) {
                    assert(
                        ChainStore.getAccountName("1.2.0") ===
                            "committee-account"
                    );
                    resolve();
                }
            });
            assert(ChainStore.getAccountName("1.2.0") === undefined);
        });
    });

    it("Non-existant account fetched by name returns null", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                let account = ChainStore.getAccount("dalkzjdalzjfaozijroazinf");
                if (account !== undefined) {
                    assert(account === null);
                    resolve();
                } else {
                    assert(false);
                    resolve();
                }
            });
            assert(
                ChainStore.getAccount("dalkzjdalzjfaozijroazinf") === undefined
            );
        });
    });

    it("Non-existant account fetched by id returns null", function() {
        return new Promise(function(resolve) {
            ChainStore.subscribe(function() {
                let account = ChainStore.getAccount("1.2.987987987");
                console.log(account);
                if (account !== undefined) {
                    assert(account === null);
                    resolve();
                } else {
                    assert(false);
                    resolve();
                }
            });
            assert(ChainStore.getAccount("1.2.987987987") === undefined);
        });
    });
});

// describe("ChainStore performance", function() {
//     before(function() {
//         return new Promise(function(resolve) {
//             return Apis.instance(
//                 "wss://eu.nodes.bitshares.ws",
//                 true
//             ).init_promise.then(function(result) {
//                 coreAsset = result[0].network.core_asset;
//                 ChainStore.init(false);
//                 resolve();
//             });
//         });
//     });
//
//     after(function() {
//         return new Promise(function(resolve) {
//             Apis.close().then(resolve);
//         });
//     });
//
//     it("Update object", function() {
//         /* Original time was ~150-170ms for 50 iterations */
//         for (var i = 0; i < 50; i++) {
//             objs.forEach(function(obj) {
//                 ChainStore._updateObject(obj);
//             });
//         }
//     });
//
//     it("Get asset", function() {
//         let assets = ["1.3.0", "1.3.121"];
//         /* Original time was ~150-170ms for 50 iterations */
//         for (var i = 0; i < 50; i++) {
//             assets.forEach(function(asset) {
//                 let a = ChainStore.getAsset(asset);
//                 if (asset === "1.3.121" && a) {
//                     assert(!!a.get("bitasset"));
//                 }
//             });
//         }
//     });
// });
