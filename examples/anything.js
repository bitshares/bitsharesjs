import {Apis} from "bitsharesjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder} from "../lib";

Apis.instance("wss://testnet.dex.trading", true)
.init_promise.then((res) => {
    console.log("connected to:", res[0].network_name, "network");

    ChainStore.init().then(() => {

        ChainStore.subscribe(function() {
            let account = ChainStore.getAccount("thtlc-3");
            console.log(account.toJS().htlcs_from);
            console.log(account.toJS().htlcs_to);
        });
        ChainStore.getAccount("thtlc-3");

    });
});
