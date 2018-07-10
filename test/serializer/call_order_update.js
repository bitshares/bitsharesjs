import {ops} from "../../lib/";
import {Apis} from "bitsharesjs-ws";

import assert from "assert";
var trans = {
    expiration: "2018-07-09T09:30:00",
    ref_block_num: 22062,
    ref_block_prefix: 3050763070,
    operations: [
        [
            3,
            {
                fee: {
                    amount: 100,
                    asset_id: "1.3.0"
                },
                funding_account: "1.2.103393",
                delta_collateral: {
                    amount: 1000,
                    asset_id: "1.3.0"
                },
                delta_debt: {
                    amount: 10,
                    asset_id: "1.3.113"
                },
                extensions: {
                    target_collateral_ratio: 200
                }
            }
        ]
    ]
};

// curl - d '{"id":1,"method":"call","params":[0,"get_transaction_hex",[{}]]}' https://btsapi.magicw.net/ws
describe("call_order_update serialization", function() {
    describe("with extensions", function() {
        it("same as backend", function(done) {
            this.timeout(3000);
            Apis.instance(
                "wss://bts.open.icowallet.net/ws",
                true
            ).init_promise.then(() => {
                var b = ops.transaction.toBuffer(trans);

                //console.log(b.toString('hex'));
                return Apis.instance()
                    .db_api()
                    .exec("get_transaction_hex", [trans])
                    .then(r => {
                        //console.log(r);
                        var b2 = new Buffer(r, "hex");
                        // console.log(b2.length);
                        assert.equal(b2.length, b.length + 1);
                        assert.equal(
                            b.toString("hex"),
                            r.slice(0, b2.length * 2 - 2)
                        );
                        done();
                    })
                    .catch(console.error);
            });
        });
    });
});
