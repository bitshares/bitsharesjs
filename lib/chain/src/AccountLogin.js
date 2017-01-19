import PrivateKey from "../../ecc/src/PrivateKey";
import key from "../../ecc/src/KeyUtils";

import {get, set} from "./state";

var _keyCachePriv = {};
var _keyCachePub = {};

class AccountLogin {

    constructor() {
        let state = {loggedIn: false, roles: ["active", "owner", "memo"]};
        this.get = get(state);
        this.set = set(state);

        this.subs = {};
    }

    addSubscription(cb) {
        this.subs[cb] = cb;
    }

    setRoles(roles) {
        this.set("roles", roles);
    }

    generateKeys(accountName, password, roles, prefix) {
        var start = new Date().getTime();
        if (!accountName || !password) {
            throw new Error("Account name or password required");
        }
        if (password.length < 12) {
            throw new Error("Password must have at least 12 characters");
        }

        let privKeys = {};
        let pubKeys = {};

        (roles || this.get("roles")).forEach(role => {
            let seed = accountName + role + password;
            let pkey = _keyCachePriv[seed] ? _keyCachePriv[seed] :  PrivateKey.fromSeed( key.normalize_brainKey(seed) );
            _keyCachePriv[seed] = pkey;

            privKeys[role] = pkey;
            pubKeys[role] = _keyCachePub[seed] ? _keyCachePub[seed] : pkey.toPublicKey().toString(prefix);

            _keyCachePub[seed] = pubKeys[role];
        });

        return {privKeys, pubKeys};
    }

    checkKeys({accountName, password, auths}) {
        if (!accountName || !password || !auths) {
            throw new Error("checkKeys: Missing inputs");
        }
        let hasKey = false;

        for (let role in auths) {
            let {privKeys, pubKeys} = this.generateKeys(accountName, password, [role]);
            auths[role].forEach(key => {
                if (key[0] === pubKeys[role]) {
                    hasKey = true;
                    this.set(role, {priv: privKeys[role], pub: pubKeys[role]});
                }
            });
        };

        if (hasKey) {
            this.set("name", accountName);
        }

        this.set("loggedIn", hasKey);

        return hasKey;
    }

    signTransaction(tr) {
        let myKeys = {};
        let hasKey = false;

        this.get("roles").forEach(role => {
            let myKey = this.get(role);
            if (myKey) {
                hasKey = true;
                console.log("adding signer:", myKey.pub);
                tr.add_signer(myKey.priv, myKey.pub);
            }
        });

        if (!hasKey) {
            throw new Error("You do not have any private keys to sign this transaction");
        }
    }
}

let accountLogin = new AccountLogin();

export default accountLogin;
