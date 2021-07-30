import * as Apis from "./ApiInstances";
import ChainWebSocket from "./ChainWebSocket";

class Manager {
    constructor({
        url,
        urls,
        autoFallback,
        closeCb,
        optionalApis,
        urlChangeCallback
    }) {
        this.url = url;
        this.urls = urls.filter(a => a !== url);
        this.autoFallback = autoFallback;
        this.closeCb = closeCb;
        this.optionalApis = optionalApis || {};
        this.isConnected = false;
        this.urlChangeCallback = urlChangeCallback;
    }

    setCloseCb = cb => {
        this.closeCb = cb;
    };

    static close() {
        return Apis.close();
    }

    logFailure = (method, url, err) => {
        let message = err && err.message ? err.message : "";
        console.error(
            method,
            "Failed to connect to " +
                url +
                (message ? " Error: " + JSON.stringify(message) : "")
        );
    };

    _onClose = () => {
        this.isConnected = false;

        if (this.closeCb) {
            this.closeCb();
            this.setCloseCb(null);
        }

        this.autoFallback && this.connectWithFallback();
    };

    connect = async (connect = true, url = this.url) => {
        try {
            let res = await Apis.instance(
                url,
                connect,
                undefined,
                this.optionalApis,
                this._onClose
            ).init_promise;

            this.url = url;
            this.isConnected = true;

            return res;
        } catch (err) {
            await Apis.close();
            throw err;
        }
    };

    connectWithFallback = async (
        connect = true,
        url = this.url,
        index = 0,
        resolve = null,
        reject = null
    ) => {
        if (index > this.urls.length)
            return reject(
                new Error(
                    "Tried " +
                        index +
                        " connections, none of which worked: " +
                        JSON.stringify(this.urls.concat(this.url))
                )
            );

        try {
            return await this.connect(connect, url);
        } catch (err) {
            if (this.urlChangeCallback)
                this.urlChangeCallback(this.urls[index]);
            return this.connectWithFallback(
                connect,
                this.urls[index],
                index + 1,
                resolve,
                reject
            );
        }
    };

    checkConnections = async (
        rpc_user = "",
        rpc_password = "",
        resolve,
        reject
    ) => {
        let connectionStartTimes = {};

        let fullList = this.urls.concat(this.url);
        let connectionPromises = fullList.map(async url => {
            /* Use default timeout and no reconnecting-websocket */
            let conn = new ChainWebSocket(url, () => {}, undefined, false);
            connectionStartTimes[url] = new Date().getTime();

            try {
                await conn.login(rpc_user, rpc_password);

                let result = {
                    [url]: new Date().getTime() - connectionStartTimes[url]
                };
                await conn.close();

                return result;
            } catch (err) {
                this.logFailure("checkConnections", url, err);
                if (url === this.url) {
                    this.url = this.urls[0];
                } else {
                    this.urls = this.urls.filter(a => a !== url);
                }
                await conn.close();
                return;
            }
        });

        try {
            let res = await Promise.all(connectionPromises);

            let final = res
                .filter(a => !!a)
                .sort((a, b) => {
                    return Object.values(a)[0] - Object.values(b)[0];
                })
                .reduce((f, a) => {
                    let key = Object.keys(a)[0];
                    f[key] = a[key];
                    return f;
                }, {});

            console.log(
                `Checked ${res.length} connections, ${res.length -
                    Object.keys(final).length} failed`
            );
            return final;
        } catch (err) {
            return this.checkConnections(
                rpc_user,
                rpc_password,
                resolve,
                reject
            );
        }
    };
}

export default Manager;
