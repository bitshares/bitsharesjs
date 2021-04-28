import WebSocket from "isomorphic-ws";

const SOCKET_DEBUG = false;
const MAX_SEND_LIFE = 5;
const MAX_RECV_LIFE = MAX_SEND_LIFE * 2;

class ChainWebSocket {
    constructor(
        ws_server,
        statusCb,
        connectTimeout = 5000,
        autoReconnect = true,
        keepAliveCb = null
    ) {
        this.url = ws_server;
        this.statusCb = statusCb;

        this.current_reject = null;
        this.on_reconnect = null;
        this.closed = false;
        this.send_life = MAX_SEND_LIFE;
        this.recv_life = MAX_RECV_LIFE;
        this.keepAliveCb = keepAliveCb;

        this.cbId = 0;
        this.responseCbId = 0;
        this.cbs = {};
        this.subs = {};
        this.unsub = {};

        this.connect_promise = this.connect(ws_server, connectTimeout);
    }

    connect = (server, connectTimeout) =>
        new Promise((resolve, reject) => {
            this.current_reject = reject;
            this.current_resolve = resolve;

            try {
                this.ws = new WebSocket(server);
            } catch (error) {
                this.ws = {readyState: 3, close: () => {}}; // DISCONNECTED
                reject(new Error("Invalid url", server, " closed"));
                // return this.close().then(() => {
                //     console.log("Invalid url", ws_server, " closed");
                //     // throw new Error("Invalid url", ws_server, " closed")
                //     // return this.current_reject(Error("Invalid websocket url: " + ws_server));
                // })
            }

            this.ws.onopen = this.onOpen;
            this.ws.onerror = this.onError;
            this.ws.onmessage = this.onMessage;
            this.ws.onclose = this.onClose;

            this.connectionTimeout = setTimeout(() => {
                if (this.current_reject) {
                    this.current_reject = null;
                    this.close();
                    reject(
                        new Error(
                            "Connection attempt timed out after " +
                                connectTimeout / 1000 +
                                "s"
                        )
                    );
                }
            }, connectTimeout);
        });

    onOpen = () => {
        clearTimeout(this.connectionTimeout);
        if (this.statusCb) this.statusCb("open");
        if (this.on_reconnect) this.on_reconnect();
        this.keepalive_timer = setInterval(() => {
            this.recv_life--;
            if (this.recv_life == 0) {
                console.error(this.url + " connection is dead, terminating ws");
                this.close();
                // clearInterval(this.keepalive_timer);
                // this.keepalive_timer = undefined;
                return;
            }
            this.send_life--;
            if (this.send_life == 0) {
                // this.ws.ping('', false, true);
                if (this.keepAliveCb) {
                    this.keepAliveCb(this.closed);
                }
                this.send_life = MAX_SEND_LIFE;
            }
        }, 5000);
        this.current_reject = null;
        this.current_resolve();
    };

    onError = error => {
        if (this.keepalive_timer) {
            clearInterval(this.keepalive_timer);
            this.keepalive_timer = undefined;
        }
        clearTimeout(this.connectionTimeout);
        if (this.statusCb) this.statusCb("error");

        if (this.current_reject) {
            this.current_reject(error);
        }
    };

    onMessage = message => {
        this.recv_life = MAX_RECV_LIFE;
        this.listener(JSON.parse(message.data));
    };

    onClose = () => {
        this.closed = true;
        if (this.keepalive_timer) {
            clearInterval(this.keepalive_timer);
            this.keepalive_timer = undefined;
        }

        for (var cbId = this.responseCbId + 1; cbId <= this.cbId; cbId += 1)
            this.cbs[cbId].reject(new Error("connection closed"));

        this.statusCb && this.statusCb("closed");
        this._closeCb && this._closeCb();
        this.on_close && this.on_close();
    };

    call = params => {
        if (this.ws.readyState !== 1) {
            return Promise.reject(
                new Error("websocket state error:" + this.ws.readyState)
            );
        }
        let method = params[1];
        if (SOCKET_DEBUG)
            console.log(
                '[ChainWebSocket] >---- call ----->  "id":' + (this.cbId + 1),
                JSON.stringify(params)
            );

        this.cbId += 1;

        if (
            [
                "set_subscribe_callback",
                "subscribe_to_market",
                "broadcast_transaction_with_callback",
                "set_pending_transaction_callback"
            ].includes(method)
        ) {
            // Store callback in subs map
            this.subs[this.cbId] = {
                callback: params[2][0]
            };

            // Replace callback with the callback id
            params[2][0] = this.cbId;
        }

        if (
            ["unsubscribe_from_market", "unsubscribe_from_accounts"].includes(
                method
            )
        ) {
            if (typeof params[2][0] !== "function") {
                throw new Error(
                    "First parameter of unsub must be the original callback"
                );
            }

            let unSubCb = params[2].splice(0, 1)[0];

            // Find the corresponding subscription
            for (let id in this.subs) {
                if (this.subs[id].callback === unSubCb) {
                    this.unsub[this.cbId] = id;
                    break;
                }
            }
        }

        var request = {
            method: "call",
            params: params
        };
        request.id = this.cbId;
        this.send_life = MAX_SEND_LIFE;

        return new Promise((resolve, reject) => {
            this.cbs[this.cbId] = {
                time: new Date(),
                resolve: resolve,
                reject: reject
            };
            this.ws.send(JSON.stringify(request));
        });
    };

    listener = response => {
        if (SOCKET_DEBUG)
            console.log(
                "[ChainWebSocket] <---- reply ----<",
                JSON.stringify(response)
            );

        let sub = false,
            callback = null;

        if (response.method === "notice") {
            sub = true;
            response.id = response.params[0];
        }

        if (!sub) {
            callback = this.cbs[response.id];
            this.responseCbId = response.id;
        } else {
            callback = this.subs[response.id].callback;
        }

        if (callback && !sub) {
            if (response.error) {
                callback.reject(response.error);
            } else {
                callback.resolve(response.result);
            }
            delete this.cbs[response.id];

            if (this.unsub[response.id]) {
                delete this.subs[this.unsub[response.id]];
                delete this.unsub[response.id];
            }
        } else if (callback && sub) {
            callback(response.params[1]);
        } else {
            console.log("Warning: unknown websocket response: ", response);
        }
    };

    login = (user, password) =>
        this.connect_promise.then(() =>
            this.call([1, "login", [user, password]])
        );

    close = () =>
        new Promise(res => {
            clearInterval(this.keepalive_timer);
            this.keepalive_timer = undefined;

            this._closeCb = () => {
                res();
                this._closeCb = null;
            };

            if (!this.ws) {
                console.log("Websocket already cleared", this);
                return res();
            }

            if (this.ws.terminate) {
                this.ws.terminate();
            } else {
                this.ws.close();
            }

            if (this.ws.readyState === 3) res();
        });
}

export default ChainWebSocket;
