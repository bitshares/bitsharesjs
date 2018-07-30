import {
    PrivateKey,
    PublicKey,
    Address,
    Serializer,
    ops,
    types
} from "../../lib";
import assert from "assert";

var {
    //varint32,
    uint8,
    uint16,
    uint32,
    int64,
    uint64,
    string,
    bytes,
    bool,
    array,
    fixed_array,
    protocol_id_type,
    object_id_type,
    vote_id,
    // future_extensions,
    static_variant,
    map,
    set,
    public_key,
    address,
    time_point_sec,
    optional,
    extension
} = types;

var {asset, account_name_eq_lit_predicate} = ops;

// Must stay in sync with allTypes below.

let extType = extension([{
    name: 'f1',
    type: uint16
}, {
    name: 'f2',
    type: string
}]);
let AllTypes = new Serializer("all_types", {
    uint8,
    uint16,
    uint32,
    int64,
    uint64,
    string,
    bytes: bytes(1),
    bool,
    array: array(uint8),
    fixed_array: fixed_array(2, uint8),
    protocol_id_type: protocol_id_type("account"),
    object_id_type, //vote_id,

    static_variant: array(
        static_variant([asset, account_name_eq_lit_predicate])
    ),
    map: map(uint8, uint8),
    set: set(uint8),

    public_key,
    address,
    key_auths: map(public_key, uint16),
    key_auths_2: map(public_key, uint16),

    time_optional: optional(time_point_sec),
    time_point_sec1: time_point_sec,
    time_point_sec2: time_point_sec,
    ext1: extType,
    ext2: extType,
});

// Must stay in sync with AllTypes above.
let allTypes = {
    uint8: Math.pow(2, 8) - 1,
    uint16: Math.pow(2, 16) - 1,
    uint32: Math.pow(2, 32) - 1,
    int64: "9223372036854775807",
    uint64: "9223372036854775807",

    string: "test",
    bytes: "ff",
    bool: true,
    array: [2, 1],
    fixed_array: [1, 0],
    protocol_id_type: "1.2.2222",
    object_id_type: "1.1.1", //vote_id: "2:1",

    static_variant: [
        [1, {account_id: "1.2.1", name: "abc"}],
        [0, {amount: "1", asset_id: "1.3.0"}]
    ],
    map: [[4, 3], [2, 1]],
    set: [2, 1],

    public_key: PrivateKey.fromSeed("")
        .toPublicKey()
        .toString(),
    key_auths: [
        ["GPH6agpGeRkc1zHD9MTbHaK9CKR1Pt8aU4v2GTxF6tRtf3ZC3TnU6", 1],
        ["GPH8DZinV1rFkdgs2sMMhUrk6wAyq1fTB8eLKQzcYihkgrjiv3tLn", 1]
    ],
    key_auths_2: [
        ["GPH8DZinV1rFkdgs2sMMhUrk6wAyq1fTB8eLKQzcYihkgrjiv3tLn", 1],
        ["GPH6agpGeRkc1zHD9MTbHaK9CKR1Pt8aU4v2GTxF6tRtf3ZC3TnU6", 1]
    ],
    address: Address.fromPublic(
        PrivateKey.fromSeed("").toPublicKey()
    ).toString(),

    time_optional: undefined,
    time_point_sec1: new Date(),
    time_point_sec2: Math.floor(Date.now() / 1000),
    ext1: {
        f1: 300
    },
    ext2: {
        f2: "hello"
    }
};

describe("Serializer", function() {
    describe("all types", function() {
        let {toObject, fromObject, toBuffer, fromBuffer} = AllTypes;

        toObject = toObject.bind(AllTypes);
        fromObject = fromObject.bind(AllTypes);
        toBuffer = toBuffer.bind(AllTypes);
        fromBuffer = fromBuffer.bind(AllTypes);

        it("from object", function() {
            assert(fromObject(allTypes), "serializable");
            assert(fromObject(fromObject(allTypes)), "non-serializable");
        });

        it("to object", function() {
            assert(toObject(allTypes), "serializable");
            assert.deepEqual(
                toObject(allTypes),
                toObject(allTypes),
                "serializable (single to)"
            );
            assert.deepEqual(
                toObject(toObject(allTypes)),
                toObject(allTypes),
                "serializable (double to)"
            );
            assert.deepEqual(
                toObject(fromObject(allTypes)),
                toObject(allTypes),
                "non-serializable"
            );
            assert.deepEqual(
                toObject(fromObject(fromObject(allTypes))),
                toObject(allTypes),
                "non-serializable (double from)"
            );
        });

        it("to buffer", function() {
            assert(toBuffer(allTypes), "serializable");
            assert(toBuffer(fromObject(allTypes)), "non-serializable");
            assert.equal(
                toBuffer(allTypes).toString("hex"), // serializable
                toBuffer(fromObject(allTypes)).toString("hex"), // non-serializable
                "serializable and non-serializable"
            );
        });

        it("from buffer", function() {
            assert.deepEqual(
                toObject(fromBuffer(toBuffer(allTypes))),
                toObject(allTypes),
                "serializable"
            );
            assert.deepEqual(
                toObject(fromBuffer(toBuffer(fromObject(allTypes)))),
                toObject(allTypes),
                "non-serializable"
            );
        });

        it("template", function() {
            assert(toObject(allTypes, {use_default: true}));
            assert(toObject(allTypes, {annotate: true}));
            assert(toObject({}, {use_default: true}));
            assert(toObject({}, {use_default: true, annotate: true}));
        });

        // keep last
        // it("visual check", function() {
        //     console.log(toObject(fromObject(allTypes)))
        // })
    });
});
