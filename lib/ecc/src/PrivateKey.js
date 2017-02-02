import ecurve from 'ecurve';
import {Point, getCurveByName} from 'ecurve';
import BigInteger from 'bigi';
import {encode, decode} from 'bs58';
import { sha256, sha512 } from './hash';
import PublicKey from './PublicKey';
import deepEqual from "deep-equal";
import assert from "assert";

const secp256k1 = getCurveByName('secp256k1');
const {G, n} = secp256k1;

class PrivateKey {

    /**
        @private see static functions
        @param {BigInteger}
    */
    constructor(d) { this.d = d; }

    static fromBuffer(buf) {
        if (!Buffer.isBuffer(buf)) {
            throw new Error("Expecting paramter to be a Buffer type");
        }
        if (32 !== buf.length) {
            console.log(`WARN: Expecting 32 bytes, instead got ${buf.length}, stack trace:`, new Error().stack);
        }
        if (buf.length === 0) {
            throw new Error("Empty buffer");
        }
        return new PrivateKey(BigInteger.fromBuffer(buf));
    }

    /** @arg {string} seed - any length string.  This is private, the same seed produces the same private key every time.  */
    static fromSeed(seed) { // generate_private_key
        if (!(typeof seed === 'string')) {
            throw new Error('seed must be of type string');
        }
        return PrivateKey.fromBuffer(sha256(seed));
    }

    /** @return {string} Wallet Import Format (still a secret, Not encrypted) */
    static fromWif(_private_wif) {
        var private_wif = new Buffer(decode(_private_wif));
        var version = private_wif.readUInt8(0);
        assert.equal(0x80, version, `Expected version ${0x80}, instead got ${version}`);
        // checksum includes the version
        var private_key = private_wif.slice(0, -4);
        var checksum = private_wif.slice(-4);
        var new_checksum = sha256(private_key);
        new_checksum = sha256(new_checksum);
        new_checksum = new_checksum.slice(0, 4);
        var isEqual = deepEqual(checksum, new_checksum); //, 'Invalid checksum'
        if (!isEqual) {
            throw new Error("Checksum did not match");
        }
        private_key = private_key.slice(1);
        return PrivateKey.fromBuffer(private_key);
    }

    toWif() {
        var private_key = this.toBuffer();
        // checksum includes the version
        private_key = Buffer.concat([new Buffer([0x80]), private_key]);
        var checksum = sha256(private_key);
        checksum = sha256(checksum);
        checksum = checksum.slice(0, 4);
        var private_wif = Buffer.concat([private_key, checksum]);
        return encode(private_wif);
    }

    /**
        @return {Point}
    */
    toPublicKeyPoint() {
        var Q;
        return Q = secp256k1.G.multiply(this.d);
    }

    toPublicKey() {
        if (this.public_key) { return this.public_key; }
        return this.public_key = PublicKey.fromPoint(this.toPublicKeyPoint());
    }

    toBuffer() {
        return this.d.toBuffer(32);
    }


    /** ECIES */
    get_shared_secret(public_key, legacy = false) {
        public_key = toPublic(public_key)
        let KB = public_key.toUncompressed().toBuffer()
        let KBP = Point.fromAffine(
            secp256k1,
            BigInteger.fromBuffer( KB.slice( 1,33 )), // x
            BigInteger.fromBuffer( KB.slice( 33,65 )) // y
        )
        let r = this.toBuffer()
        let P = KBP.multiply(BigInteger.fromBuffer(r))
        let S = P.affineX.toBuffer({size: 32})
        /*
        the input to sha512 must be exactly 32-bytes, to match the c++ implementation
        of get_shared_secret.  Right now S will be shorter if the most significant
        byte(s) is zero.  Pad it back to the full 32-bytes
        */
        if (!legacy && S.length < 32) {
           let pad = new Buffer(32 - S.length).fill(0);
           S = Buffer.concat([pad, S]);
        }

        // SHA512 used in ECIES
        return sha512(S)
    }

    // /** ECIES (does not always match the Point.fromAffine version above) */
    // get_shared_secret(public_key){
    //     public_key = toPublic(public_key)
    //     var P = public_key.Q.multiply( this.d );
    //     var S = P.affineX.toBuffer({size: 32});
    //     // ECIES, adds an extra sha512
    //     return sha512(S);
    // }

    /** @throws {Error} - overflow of the key could not be derived */
    child( offset ) {
        offset = Buffer.concat([ this.toPublicKey().toBuffer(), offset ])
        offset = sha256( offset )
        let c = BigInteger.fromBuffer(offset)

        if (c.compareTo(n) >= 0)
            throw new Error("Child offset went out of bounds, try again")

        let derived = this.d.add(c)//.mod(n)

        if( derived.signum() === 0 )
            throw new Error("Child offset derived to an invalid key, try again")

        return new PrivateKey( derived )
    }

    /* <helper_functions> */

    toByteBuffer() {
        var b = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
        this.appendByteBuffer(b);
        return b.copy(0, b.offset);
    }

    static fromHex(hex) {
        return PrivateKey.fromBuffer(new Buffer(hex, 'hex'));
    }

    toHex() {
        return this.toBuffer().toString('hex');
    }

    /* </helper_functions> */
}

export default PrivateKey;

let toPublic = data => data == null ? data :
    data.Q ? data : PublicKey.fromStringOrThrow(data)
