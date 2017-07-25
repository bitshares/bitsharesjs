import {
    ChainStore,
    FetchChain,
    PrivateKey,
    TransactionHelper,
    Aes,
    TransactionBuilder,
    hash,
    Signature,
    ECSignature
} from "../lib";
var privKey = "";
let pKey = PrivateKey.fromWif(privKey);
var secp256k1 = require("secp256k1");

let str = "asasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdas123dasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasdasasdasdasd";
// let str ='1';

let start = new Date();
let sign1 = Signature.sign(str, pKey).toHex();
console.log('老方法签名结果:', sign1);
console.log('老方法签名耗时:', new Date().getTime() - start);

start = new Date();
let hashStr = hash.sha256(new Buffer(str));
let nonce = 0;
let sigDER = null;
let sig = null;
while (true) {
    sig = secp256k1.sign(hashStr, pKey.toBuffer(), {
        noncefn: function () {
            return hash.sha256(new Buffer(hashStr + (nonce++)));
        }
    });
    sigDER = secp256k1.signatureExport(sig.signature);
    let lenR = sigDER[3];
    let lenS = sigDER[5 + lenR];
    console.log(sigDER, lenR, lenS);
    if (lenR === 32 && lenS === 32) {
        console.log(sigDER, nonce);
        break;
    }
    if (nonce % 10 === 0) {
        console.log("WARN: " + nonce + " attempts to find canonical signature");
    }
}

let ecsig = ECSignature.fromDER(sigDER);
let signature = new Signature(ecsig.r, ecsig.s, sig.recovery + 31);
console.log('新方法签名结果:', signature.toHex());
console.log('新方法签名耗时:', new Date().getTime() - start);

