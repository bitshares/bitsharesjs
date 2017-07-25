
import {PrivateKey, key} from "../lib";

let seed = "THIS IS A TERRIBLE BRAINKEY SEED WORD SEQUENCE";
let pkey = PrivateKey.fromSeed( key.normalize_brainKey(seed) );

console.log("\nPrivate key:", pkey.toWif());
console.log("Public key :", pkey.toPublicKey().toString(), "\n");

let start = new Date();
let result = pkey.get_shared_secret(pkey.toPublicKey().toPublicKeyString());
console.log('result:',result,'cost:',new Date()-start,'\n--------------');
start = new Date();
result = pkey.get_shared_secret_v2(pkey.toPublicKey().toPublicKeyString());
console.log('result:',result,'cost:',new Date()-start);