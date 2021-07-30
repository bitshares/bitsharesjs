# Bitshares websocket interface (bitsharesjs-ws)

Pure JavaScript Bitshares websocket library for node.js and browsers. Can be used to easily connect to and obtain data from the Bitshares blockchain via public apis or local nodes.

Credit for the original implementation goes to [jcalfeee](https://github.com/jcalfee).

[![npm version](https://img.shields.io/npm/v/bitsharesjs-ws.svg?style=flat-square)](https://www.npmjs.com/package/bitsharesjs-ws)
[![npm downloads](https://img.shields.io/npm/dm/bitsharesjs-ws.svg?style=flat-square)](https://www.npmjs.com/package/bitsharesjs-ws)

## Setup

This library can be obtained through npm:

```
npm install bitsharesjs-ws
```

## Usage

Several examples are available in the /examples folder, and the tests in /test also show how to use the library.

Browser bundles are provided in /build/, for testing purposes you can access this from rawgit:

```
<script type="text/javascript" src="https://cdn.rawgit.com/bitshares/bitsharesjs-ws/build/bitsharesjs-ws.js" />
```

A variable bitshares_ws will be available in window.

For use in a webpack/browserify context, see the example below for how to open a websocket connection to the Openledger API and subscribe to any object updates:

```
var {Apis} = require("bitsharesjs-ws");
Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then((res) => {
    console.log("connected to:", res[0].network);
    Apis.instance().db_api().exec( "set_subscribe_callback", [ updateListener, true ] )
});

function updateListener(object) {
    console.log("set_subscribe_callback:\n", object);
}
```

The `set_subscribe_callback` callback (updateListener) will be called whenever an object on the blockchain changes or is removed. This is very powerful and can be used to listen to updates for specific accounts, assets or most anything else, as all state changes happen through object updates. Be aware though that you will receive quite a lot of data this way.

# Witness node endpoints

This is a non-exhaustive list of endpoints available from the witness_node executable, which provides the API server of Bitshares.

## database_api

https://github.com/bitshares/bitshares-core/blob/master/libraries/app/database_api.cpp

**Usage examples**
`Apis.instance().db_api().exec(method, params)`
`Apis.instance().db_api().exec("get_objects, [["1.3.0", "2.0.0", "2.1.0"]])`

### Objects

| Method Name |       Params       |
| ----------- | :----------------: |
| get_objects | [array object_ids] |

### Subscriptions

| Method Name                      |                     Params                     |
| -------------------------------- | :--------------------------------------------: |
| set_subscribe_callback           | [function callback, bool notify_remove_create] |
| set_pending_transaction_callback |              [function callback]               |
| set_block_applied_callback       |              [function callback]               |
| cancel_all_subscriptions         |                       []                       |

### Blocks and transactions

| Method Name            |              Params               |
| ---------------------- | :-------------------------------: |
| get_block_header       |          [int block_num]          |
| get_block_header_batch |        [array block_nums]         |
| get_block              |          [int block_num]          |
| get_transaction        | [int block_num, int trx_in_block] |

### Globals

| Method Name                   | Params |
| ----------------------------- | :----: |
| get_chain_properties          |   []   |
| get_global_properties         |   []   |
| get_config                    |   []   |
| get_chain_id                  |   []   |
| get_dynamic_global_properties |   []   |

### Keys

| Method Name              |       Params        |
| ------------------------ | :-----------------: |
| get_key_references       | [array public_keys] |
| is_public_key_registered | [string public_key] |

### Accounts

| Method Name            |                    Params                    |
| ---------------------- | :------------------------------------------: |
| get_accounts           |             [array account_ids]              |
| get_full_accounts      | [array account_names_or_ids, bool subscribe] |
| get_account_by_name    |                [string name]                 |
| get_account_references |             [string account_id]              |
| lookup_account_names   |            [array account_names]             |
| lookup_accounts        |     [string lower_bound_name, int limit]     |
| get_account_count      |                      []                      |

### Assets

| Method Name          |                 Params                 |
| -------------------- | :------------------------------------: |
| get_assets           |           [array asset_ids]            |
| list_assets          | [string lower_bound_symbol, int limit] |
| lookup_asset_symbols |         [array symbols_or_ids]         |

### Markets / feeds

| Method Name             |                            Params                             |
| ----------------------- | :-----------------------------------------------------------: |
| get_limit_orders        |       [string asset_id_a, string asset_id_b, int limit]       |
| get_call_orders         |                 [string asset_id, int limit]                  |
| get_settle_orders       |                 [string asset_id, int limit]                  |
| get_margin_positions    |                      [string account_id]                      |
| subscribe_to_market     |   [function callback, string asset_id_a, string asset_id_b]   |
| unsubscribe_from_market |            [string asset_id_a, string asset_id_b]             |
| get_ticker              |                  [string base, string quote]                  |
| get_24_volume           |                  [string base, string quote]                  |
| get_order_book          |            [string base, string quote, int limit]             |
| get_trade_history       | [string base, string quote, date start, date stop, int limit] |

## Tests

The tests show several use cases, to run, simply type `npm run test`. The tests require a local witness node to be running, as well as an active internet connection.
