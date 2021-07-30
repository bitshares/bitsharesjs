import ChainWebSocket from "./ChainWebSocket";
import GrapheneApi from "./GrapheneApi";
import ChainConfig from "./ChainConfig";

let autoReconnect = false; // by default don't use reconnecting-websocket

var Apis = null;
var statusCb = null;

export const setRpcConnectionStatusCallback = callback => {
    statusCb = callback;
    if (Apis) Apis.setRpcConnectionStatusCallback(callback);
};

export const setAutoReconnect = auto => {
    autoReconnect = auto;
};

export const reset = (
    cs = "ws://localhost:8090",
    connect,
    connectTimeout = 4000,
    optionalApis,
    closeCb
) => {
    return close().then(() => {
        Apis = newApis();
        Apis.setRpcConnectionStatusCallback(statusCb);

        if (Apis && connect)
            Apis.connect(cs, connectTimeout, optionalApis, closeCb);

        return Apis;
    });
};

export const instance = (
    cs = "ws://localhost:8090",
    connect,
    connectTimeout = 4000,
    optionalApis,
    closeCb
) => {
    if (!Apis) {
        Apis = newApis();
        Apis.setRpcConnectionStatusCallback(statusCb);
    }

    if (Apis && connect) {
        Apis.connect(cs, connectTimeout, optionalApis);
    }
    if (closeCb) Apis.closeCb = closeCb;
    return Apis;
};

export const chainId = () => {
    return instance().chain_id;
};

export const close = async () => {
    if (Apis) {
        await Apis.close();
        Apis = null;
    }
};

const get = name =>
    new Proxy([], {
        get: (_, method) => (...args) => Apis[name].exec(method, [...args])
    });

export const db = get("_db");
export const network = get("_net");
export const history = get("_hist");
export const crypto = get("_crypt");
export const orders = get("_orders");

const newApis = () => ({
    connect: (
        cs,
        connectTimeout,
        optionalApis = {enableCrypto: false, enableOrders: false}
    ) => {
        // console.log("INFO\tApiInstances\tconnect\t", cs);
        Apis.url = cs;
        let rpc_user = "",
            rpc_password = "";
        if (
            typeof window !== "undefined" &&
            window.location &&
            window.location.protocol === "https:" &&
            cs.indexOf("wss://") < 0
        ) {
            throw new Error("Secure domains require wss connection");
        }

        if (Apis.ws_rpc) {
            Apis.ws_rpc.statusCb = null;
            Apis.ws_rpc.keepAliveCb = null;
            Apis.ws_rpc.on_close = null;
            Apis.ws_rpc.on_reconnect = null;
        }
        Apis.ws_rpc = new ChainWebSocket(
            cs,
            Apis.statusCb,
            connectTimeout,
            autoReconnect,
            closed => {
                if (Apis._db && !closed) {
                    Apis._db.exec("get_objects", [["2.1.0"]]).catch(e => {});
                }
            }
        );

        Apis.init_promise = Apis.ws_rpc
            .login(rpc_user, rpc_password)
            .then(() => {
                //console.log("Connected to API node:", cs);
                Apis._db = new GrapheneApi(Apis.ws_rpc, "database");
                Apis._net = new GrapheneApi(Apis.ws_rpc, "network_broadcast");
                Apis._hist = new GrapheneApi(Apis.ws_rpc, "history");
                if (optionalApis.enableOrders)
                    Apis._orders = new GrapheneApi(Apis.ws_rpc, "orders");
                if (optionalApis.enableCrypto)
                    Apis._crypt = new GrapheneApi(Apis.ws_rpc, "crypto");
                var db_promise = Apis._db.init().then(() => {
                    //https://github.com/cryptonomex/graphene/wiki/chain-locked-tx
                    return Apis._db.exec("get_chain_id", []).then(_chain_id => {
                        Apis.chain_id = _chain_id;
                        return ChainConfig.setChainId(_chain_id);
                        //DEBUG console.log("chain_id1",this.chain_id)
                    });
                });
                Apis.ws_rpc.on_reconnect = () => {
                    if (!Apis.ws_rpc) return;
                    Apis.ws_rpc.login("", "").then(() => {
                        Apis._db.init().then(() => {
                            if (Apis.statusCb) Apis.statusCb("reconnect");
                        });
                        Apis._net.init();
                        Apis._hist.init();
                        if (optionalApis.enableOrders) Apis._orders.init();
                        if (optionalApis.enableCrypto) Apis._crypt.init();
                    });
                };
                Apis.ws_rpc.on_close = () => {
                    Apis.close().then(() => {
                        if (Apis.closeCb) Apis.closeCb();
                    });
                };
                let initPromises = [
                    db_promise,
                    Apis._net.init(),
                    Apis._hist.init()
                ];

                if (optionalApis.enableOrders)
                    initPromises.push(Apis._orders.init());
                if (optionalApis.enableCrypto)
                    initPromises.push(Apis._crypt.init());
                return Promise.all(initPromises);
            })
            .catch(err => {
                console.error(
                    cs,
                    "Failed to initialize with error",
                    err && err.message
                );
                return Apis.close().then(() => {
                    throw err;
                });
            });
    },
    close: async () => {
        if (Apis.ws_rpc && Apis.ws_rpc.ws.readyState === 1)
            await Apis.ws_rpc.close();

        Apis.ws_rpc = null;
    },
    db_api: () => Apis._db,
    network_api: () => Apis._net,
    history_api: () => Apis._hist,
    crypto_api: () => Apis._crypt,
    orders_api: () => Apis._orders,
    setRpcConnectionStatusCallback: callback => (Apis.statusCb = callback)
});
