import {
    PrivateKey,
    PublicKey,
    Address,
    Serializer,
    ops,
    types
} from "../../lib";
// import { Apis } from 'bitsharesjs-ws';
import {Apis, ChainConfig} from "bitsharesjs-ws";
import assert from "assert";

describe("issue13", function() {
    after(function() {
        return new Promise(function(resolve) {
            Apis.close().then(resolve);
        });
    });

    it("should fixed", function() {
        var a = {
            ref_block_num: 50063,
            ref_block_prefix: 1540806710,
            expiration: "2017-12-01T09:01:33",
            operations: [
                [
                    6,
                    {
                        fee: {amount: "1213", asset_id: "1.3.0"},
                        account: "1.2.444731",
                        owner: {
                            weight_threshold: 3,
                            account_auths: [
                                ["1.2.158546", 1],
                                ["1.2.441503", 1]
                            ],
                            key_auths: [
                                [
                                    "BTS8DZinV1rFkdgs2sMMhUrk6wAyq1fTB8eLKQzcYihkgrjiv3tLn",
                                    1
                                ],
                                [
                                    "BTS6agpGeRkc1zHD9MTbHaK9CKR1Pt8aU4v2GTxF6tRtf3ZC3TnU6",
                                    1
                                ]
                            ],
                            address_auths: []
                        },
                        active: {
                            weight_threshold: 2,
                            account_auths: [
                                ["1.2.441503", 1],
                                ["1.2.477163", 1]
                            ],
                            key_auths: [
                                [
                                    "BTS517Q7o3TgYnsaduUwLRUekPdHzu1cgx9LtskoRJghJ8yeo19eR",
                                    1
                                ]
                            ],
                            address_auths: []
                        },
                        extensions: []
                    }
                ]
            ],
            extensions: [],
            signatures: []
        };
        return Apis.instance(
            "wss://eu.nodes.bitshares.ws",
            true
        ).init_promise.then(() => {
            var b = ops.transaction.toBuffer(a);
            // get from backend. remove signatures. see https://github.com/bitshares/bitsharesjs/issues/13#issuecomment-348684435
            var c =
                "8fc336d8d65b6d1a215a0106bd0400000000000000bb921b010300000002d2d60901009ff91a01000202def83f652f3d47a2f96b97928779bcc7155db4c1fa7570f60e3af07647777da6010003b666ae35954e2b7b3e5e3430f49b0a971b3e8f13cfb3240055205f758abfd6250100000102000000029ff91a0100eb8f1d010001020f08edaefcacd7dd29ffb51b4b3b20fe1f5c0946b4e11fd499c093a5234201d0010000000000";
            assert(b);
            assert(b.toString("hex") == c);
        });
    });
});
