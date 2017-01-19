import assert from "assert";
import {Apis, ChainConfig} from "bitsharesjs-ws";
import { FetchChain, ChainStore } from "../../lib";

var coreAsset;

describe("ChainStore", () => {
    // Connect once for all tests
    before(function() {
        /* use wss://bitshares.openledger.info/ws if no local node is available */
        return Apis.instance("ws://127.0.0.1:8090", true).init_promise.then(function (result) {
            coreAsset = result[0].network.core_asset;
            ChainStore.init();
        });
    });

    // Unsubscribe everything after each test
    afterEach(function() {
        ChainStore.subscribers = new Set();
        ChainStore.clearCache();
    });

    after(function() {
        ChainConfig.reset();
    });

    describe("Subscriptions", function() {

        it("Asset not found", function() {
            return new Promise( function(resolve) {
                ChainStore.subscribe(function() {
                    assert(ChainStore.getAsset("NOTFOUND") === null)
                    resolve()
                })
                assert(ChainStore.getAsset("NOTFOUND") === undefined)
            })
        })

        it("Asset by name", function() {
            return new Promise( function(resolve) {
                ChainStore.subscribe(function() {
                    assert(ChainStore.getAsset(coreAsset) != null)
                    resolve()
                })
                assert(ChainStore.getAsset(coreAsset) === undefined)
            })
        })

        it("Asset by id", function() {
            return new Promise( function(resolve) {
                ChainStore.subscribe(function() {
                    assert(ChainStore.getAsset("1.3.0") != null)
                    resolve()
                })
                assert(ChainStore.getAsset("1.3.0") === undefined)
            })
        })

        it("Object by id", function() {
            return new Promise( function(resolve) {
                ChainStore.subscribe(function() {
                    assert(ChainStore.getAsset("2.0.0") != null)
                    resolve()
                })
                assert(ChainStore.getAsset("2.0.0") === undefined)
            })
        })


    })
        //     ChainStore.getAccount("not found")
        //
        //     ChainStore.unsubscribe(cb)
        //     // return FetchChain("getAccount", "notfound")
        //     let cb = res => console.log('res',res)
        //     // })
        // })


})
