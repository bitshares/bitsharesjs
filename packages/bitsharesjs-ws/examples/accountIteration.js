// Node.js example
// This example shows how to iterate over all accounts in order determine
// the holders of a particular asset, in this case OBITS. It will do heavy polling so
// I recommend using a local node

/* running 'npm run build' is necessary before launching the examples */

var {Apis} = require("../cjs");
// let wsString = "wss://bitshares.openledger.info/ws";
let wsStringLocal = "ws://127.0.0.1:8090";

let holders = {};

Apis.instance(wsStringLocal, true).init_promise.then(res => {
    console.log("connected to:", res[0].network);

    Apis.instance()
        .db_api()
        .exec("lookup_asset_symbols", [["OBITS"]])
        .then(assets => {
            console.log("OBITS id:", assets[0].id);
            let assetID = assets[0].id;

            let maxIter = 2;
            let iterations = 0;
            let accountLimit = 500;
            function balanceCheck(startChar) {
                console.log("balanceCheck:", startChar);
                try {
                    lookupAccounts(startChar, accountLimit).then(accounts => {
                        accounts.forEach(account => {
                            if ("balances" in account[1]) {
                                for (
                                    let i = 0;
                                    i < account[1].balances.length;
                                    i++
                                ) {
                                    if (
                                        account[1].balances[i].asset_type ===
                                            assetID &&
                                        parseInt(
                                            account[1].balances[i].balance,
                                            10
                                        ) > 0
                                    ) {
                                        // console.log(account[1].account.name, "has OBITS");
                                        holders[account[1].account.name] =
                                            account[1].balances[i].balance;
                                        break;
                                    }
                                }
                            }
                        });
                        if (
                            accounts.length === accountLimit &&
                            iterations < maxIter
                        ) {
                            iterations++;
                            console.log(
                                "Starting new iteration, so far found",
                                Object.keys(holders).length,
                                "holders"
                            );
                            return balanceCheck(
                                accounts[accounts.length - 1][1].account.name
                            );
                        } else {
                            // DONE, save holders to a file here
                            console.log(
                                "Found",
                                Object.keys(holders).length,
                                "OBITS holders"
                            );
                        }
                    });
                } catch (err) {
                    console.log("err:", err);
                }
            }

            balanceCheck("a");
        });
});

function lookupAccounts(startChar, limit = 1) {
    return Apis.instance()
        .db_api()
        .exec("lookup_accounts", [startChar, limit])
        .then(accounts => {
            let newInput = accounts.map(account => {
                return account[0];
            });
            return Apis.instance()
                .db_api()
                .exec("get_full_accounts", [newInput, false]);
        })
        .catch(err => {
            console.log("err:", err);
        });
}
