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

let str = JSON.stringify({"account_id":"1.2.19","data":"IvXmqAXcpIJDqkFoCZ6oWjbCU/d/EIbacEGrX2iUDL56jG3fpkoPFH17PvUWrbWW14MQl5XQwX+Lr9KM1ZkD/rmJVs4caSMmnaR7W5d4L68=","data_hash":"c637263ec17b0f21d924befa5dbddb67c7842155cf6acd696984b11cfb5b7001","request_id":"3e2aeb347de486f503f0afaf5b3cdf9cb9d6044b473f5225a19ee1feae37a083"}
);
// let str ='1';

let start = new Date();
let sign1 = Signature.sign(str, pKey).toHex();
console.log('签名耗时:',new Date()-start,sign1);
start = new Date();
let result = Signature.fromHex(sign1).verifyBuffer(str,pKey.toPublicKey());
console.log('验证结果:',result,'验证耗时:',new Date()-start);
