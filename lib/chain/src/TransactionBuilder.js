import assert from "assert";
import {Signature, PublicKey, hash} from "../../ecc";
import {ops} from "../../serializer";
import {Apis, ChainConfig} from "bitsharesjs-ws";
import ChainTypes from "./ChainTypes";
const Buffer = require("safe-buffer").Buffer;

var head_block_time_string, committee_min_review;

class TransactionBuilder {
    constructor(tx = null) {
        this.signer_private_keys = [];

        if (tx) {
            this.expiration = tx.expiration;
            this.ref_block_num = tx.ref_block_num;
            this.ref_block_prefix = tx.ref_block_prefix;
            this.signatures = tx.signatures;
            this.operations = [];
            for (var i = 0; i < tx.operations.length; ++i) {
                this.add_operation(tx.operations[i]);
            }
        } else {
            this.ref_block_num = 0;
            this.ref_block_prefix = 0;
            this.expiration = 0;
            this.operations = [];
            this.signatures = [];
        }

        // semi-private method bindings
        this._broadcast = _broadcast.bind(this);
    }

    /**
        @arg {string} name - like "transfer"
        @arg {object} operation - JSON matchching the operation's format
    */
    add_type_operation(name, operation) {
        this.add_operation(this.get_type_operation(name, operation));
        return;
    }

    /**
        This does it all: set fees, finalize, sign, and broadcast (if wanted).

        @arg {ConfidentialWallet} cwallet - must be unlocked, used to gather signing keys

        @arg {array<string>} [signer_pubkeys = null] - Optional ["GPHAbc9Def0...", ...].  These are additional signing keys.  Some balance claims require propritary address formats, the witness node can't tell us which ones are needed so they must be passed in.  If the witness node can figure out a signing key (mostly all other transactions), it should not be passed in here.

        @arg {boolean} [broadcast = false]
    */
    process_transaction(cwallet, signer_pubkeys = null, broadcast = false) {
        let wallet_object = cwallet.wallet.wallet_object;
        if (Apis.instance().chain_id !== wallet_object.get("chain_id"))
            return Promise.reject(
                "Mismatched chain_id; expecting " +
                    wallet_object.get("chain_id") +
                    ", but got " +
                    Apis.instance().chain_id
            );

        return this.set_required_fees().then(() => {
            var signer_pubkeys_added = {};
            if (signer_pubkeys) {
                // Balance claims are by address, only the private
                // key holder can know about these additional
                // potential keys.
                var pubkeys = cwallet.getPubkeys_having_PrivateKey(
                    signer_pubkeys
                );
                if (!pubkeys.length) throw new Error("Missing signing key");

                for (let pubkey_string of pubkeys) {
                    var private_key = cwallet.getPrivateKey(pubkey_string);
                    this.add_signer(private_key, pubkey_string);
                    signer_pubkeys_added[pubkey_string] = true;
                }
            }

            return this.get_potential_signatures()
                .then(({pubkeys, addys}) => {
                    var my_pubkeys = cwallet.getPubkeys_having_PrivateKey(
                        pubkeys,
                        addys
                    );

                    //{//Testing only, don't send All public keys!
                    //    var pubkeys_all = PrivateKeyStore.getPubkeys() // All public keys
                    //    this.get_required_signatures(pubkeys_all).then( required_pubkey_strings =>
                    //        console.log('get_required_signatures all\t',required_pubkey_strings.sort(), pubkeys_all))
                    //    this.get_required_signatures(my_pubkeys).then( required_pubkey_strings =>
                    //        console.log('get_required_signatures normal\t',required_pubkey_strings.sort(), pubkeys))
                    //}

                    return this.get_required_signatures(my_pubkeys).then(
                        required_pubkeys => {
                            for (let pubkey_string of required_pubkeys) {
                                if (signer_pubkeys_added[pubkey_string])
                                    continue;
                                var private_key = cwallet.getPrivateKey(
                                    pubkey_string
                                );
                                if (!private_key)
                                    // This should not happen, get_required_signatures will only
                                    // returned keys from my_pubkeys
                                    throw new Error(
                                        "Missing signing key for " +
                                            pubkey_string
                                    );
                                this.add_signer(private_key, pubkey_string);
                            }
                        }
                    );
                })
                .then(() => (broadcast ? this.broadcast() : this.serialize()));
        });
    }

    /** Typically this is called automatically just prior to signing.  Once finalized this transaction can not be changed. */
    finalize() {
        return new Promise((resolve, reject) => {
            if (this.tr_buffer) {
                throw new Error("already finalized");
            }

            let _finalize = () => {
                var iterable = this.operations;
                for (var i = 0, op; i < iterable.length; i++) {
                    op = iterable[i];
                    if (op[1]["finalize"]) {
                        op[1].finalize();
                    }
                }
                this.tr_buffer = ops.transaction.toBuffer(this);
            };

            // check if api call is necessary at all
            if (
                this.expiration !== 0 &&
                this.ref_block_num !== 0 &&
                this.ref_block_prefix !== 0
            ) {
                _finalize();
                resolve();
            } else {
                resolve(
                    Apis.instance()
                        .db_api()
                        .exec("get_objects", [["2.1.0"]])
                        .then(r => {
                            head_block_time_string = r[0].time;
                            if (this.expiration === 0)
                                this.expiration =
                                    base_expiration_sec() +
                                    ChainConfig.expire_in_secs;
                            if (
                                this.ref_block_num === 0 &&
                                this.ref_block_prefix === 0
                            ) {
                                this.ref_block_num =
                                    r[0].head_block_number & 0xffff;
                                this.ref_block_prefix = new Buffer(
                                    r[0].head_block_id,
                                    "hex"
                                ).readUInt32LE(4);
                            }
                            _finalize();
                        })
                );
            }
        });
    }

    /** @return {string} hex transaction ID */
    id() {
        if (!this.tr_buffer) {
            throw new Error("not finalized");
        }
        return hash
            .sha256(this.tr_buffer)
            .toString("hex")
            .substring(0, 40);
    }

    /**
        Typically one will use {@link this.add_type_operation} instead.
        @arg {array} operation - [operation_id, operation]
    */
    add_operation(operation) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        assert(operation, "operation");
        if (!Array.isArray(operation)) {
            throw new Error("Expecting array [operation_id, operation]");
        }
        this.operations.push(operation);
        return;
    }

    get_type_operation(name, operation) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        assert(name, "name");
        assert(operation, "operation");
        var _type = ops[name];
        assert(_type, `Unknown operation ${name}`);
        var operation_id = ChainTypes.operations[_type.operation_name];
        if (operation_id === undefined) {
            throw new Error(`unknown operation: ${_type.operation_name}`);
        }
        if (!operation.fee) {
            operation.fee = {amount: 0, asset_id: 0};
        }
        if (name === "proposal_create") {
            /*
            * Proposals involving the committee account require a review
            * period to be set, look for them here
            */
            let requiresReview = false,
                extraReview = 0;
            operation.proposed_ops.forEach(op => {
                const COMMITTE_ACCOUNT = 0;
                let key;

                switch (op.op[0]) {
                    case 0: // transfer
                        key = "from";
                        break;

                    case 6: //account_update
                    case 17: // asset_settle
                        key = "account";
                        break;

                    case 10: // asset_create
                    case 11: // asset_update
                    case 12: // asset_update_bitasset
                    case 13: // asset_update_feed_producers
                    case 14: // asset_issue
                    case 18: // asset_global_settle
                    case 43: // asset_claim_fees
                        key = "issuer";
                        break;

                    case 15: // asset_reserve
                        key = "payer";
                        break;

                    case 16: // asset_fund_fee_pool
                        key = "from_account";
                        break;

                    case 22: // proposal_create
                    case 23: // proposal_update
                    case 24: // proposal_delete
                        key = "fee_paying_account";
                        break;

                    case 31: // committee_member_update_global_parameters
                        requiresReview = true;
                        extraReview = 60 * 60 * 24 * 13; // Make the review period 2 weeks total
                        break;
                }
                if (key in op.op[1] && op.op[1][key] === COMMITTE_ACCOUNT) {
                    requiresReview = true;
                }
            });
            operation.expiration_time ||
                (operation.expiration_time =
                    base_expiration_sec() +
                    ChainConfig.expire_in_secs_proposal);
            if (requiresReview) {
                operation.review_period_seconds =
                    extraReview +
                    Math.max(
                        committee_min_review,
                        24 * 60 * 60 || ChainConfig.review_in_secs_committee
                    );
                /*
                * Expiration time must be at least equal to
                * now + review_period_seconds, so we add one hour to make sure
                */
                operation.expiration_time += 60 * 60 + extraReview;
            }
        }
        var operation_instance = _type.fromObject(operation);
        return [operation_id, operation_instance];
    }

    /* optional: fetch the current head block */

    update_head_block() {
        return Promise.all([
            Apis.instance()
                .db_api()
                .exec("get_objects", [["2.0.0"]]),
            Apis.instance()
                .db_api()
                .exec("get_objects", [["2.1.0"]])
        ]).then(function(res) {
            let [g, r] = res;
            head_block_time_string = r[0].time;
            committee_min_review =
                g[0].parameters.committee_proposal_review_period;
        });
    }

    /** optional: there is a deafult expiration */
    set_expire_seconds(sec) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        return (this.expiration = base_expiration_sec() + sec);
    }

    /* Wraps this transaction in a proposal_create transaction */
    propose(proposal_create_options) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        if (!this.operations.length) {
            throw new Error("add operation first");
        }

        assert(proposal_create_options, "proposal_create_options");
        assert(
            proposal_create_options.fee_paying_account,
            "proposal_create_options.fee_paying_account"
        );

        let proposed_ops = this.operations.map(op => {
            return {op: op};
        });

        this.operations = [];
        this.signatures = [];
        this.signer_private_keys = [];
        proposal_create_options.proposed_ops = proposed_ops;
        this.add_type_operation("proposal_create", proposal_create_options);
        return this;
    }

    has_proposed_operation() {
        let hasProposed = false;
        for (var i = 0; i < this.operations.length; i++) {
            if ("proposed_ops" in this.operations[i][1]) {
                hasProposed = true;
                break;
            }
        }

        return hasProposed;
    }

    /** optional: the fees can be obtained from the witness node */
    set_required_fees(asset_id, removeDuplicates) {
        if (this.tr_buffer) {
            throw new Error("already finalized");
        }
        if (!this.operations.length) {
            throw new Error("add operations first");
        }

        function isProposal(op) {
            return op[0] === 22;
        }

        let operations = [];
        let proposed_ops = [];
        let feeAssets = [];
        let proposalFeeAssets = [];
        let potentialDuplicates = {};
        function getDuplicateOriginalIndex(op, index) {
            let key = getOperationKey(op);
            let duplicate = potentialDuplicates[key];
            if (!!duplicate) {
                if (duplicate.original === index) return index;
                else if (duplicate.duplicates.indexOf(index) !== -1) {
                    return duplicate.original;
                }
            }
        }
        function getOperationKey(op) {
            let key = null;
            switch (op[0]) {
                case 0: // transfer
                    let memoDummy = new Array(
                        op[1].memo.message.length + 1
                    ).join("a");
                    key = `${op[0]}_${op[1].amount.asset_id}_${memoDummy}`;
                    break;
                default:
            }
            return key;
        }
        for (let i = 0, op; i < this.operations.length; i++) {
            op = this.operations[i];
            let opObject = ops.operation.toObject(op);
            let isDuplicate = false;
            if (removeDuplicates) {
                let key = getOperationKey(opObject);
                if (key) {
                    if (!potentialDuplicates[key])
                        potentialDuplicates[key] = {
                            original: i,
                            duplicates: []
                        };
                    else {
                        potentialDuplicates[key].duplicates.push(i);
                        isDuplicate = true;
                    }
                }
            }
            /*
            * If the operation creates a proposal, we should check the fee pool
            * of the suggested proposal fee assets to prevent users from creating
            * proposals that will most likely fail due to empty fee pools
            */
            if (isProposal(op)) {
                op[1].proposed_ops.forEach(proposal => {
                    proposed_ops.push(proposal);
                    if (
                        proposalFeeAssets.indexOf(
                            proposal.op[1].fee.asset_id
                        ) === -1
                    )
                        proposalFeeAssets.push(
                            "1.3." + proposal.op[1].fee.asset_id
                        );
                });
            }
            if (!isDuplicate) {
                operations.push(opObject);
                if (feeAssets.indexOf(operations[i][1].fee.asset_id) === -1)
                    feeAssets.push(operations[i][1].fee.asset_id);
            }
        }

        if (!asset_id) {
            let op1_fee = operations[0][1].fee;
            if (op1_fee && op1_fee.asset_id !== null) {
                asset_id = op1_fee.asset_id;
            } else {
                asset_id = "1.3.0";
            }
        }

        /*
        * Add the proposal fee asset ids to feeAssets here to fetch their
        * fees and dynamic objects
        */
        if (proposalFeeAssets.length) {
            proposalFeeAssets.forEach(id => {
                if (feeAssets.indexOf(id) === -1) feeAssets.push(id);
            });
        }
        let promises = [];
        promises.push(
            Promise.all(
                feeAssets.map(id => {
                    return Apis.instance()
                        .db_api()
                        .exec("get_required_fees", [operations, id]);
                })
            ).catch(err => {
                console.error("get_required_fees API error: ", err.message);
            })
        );

        if (feeAssets.length > 1 || feeAssets[0] !== "1.3.0") {
            /*
            * If we're paying with any assets other than CORE, we need to fetch
            * the dynamic asset object and check the fee pool of those assets.
            * The dynamic asset object id is equal to the asset id but with
            * 2.3.x instead of 1.3.x
            */
            let dynamicObjectIds = feeAssets.map(a => a.replace(/^1\./, "2."));
            promises.push(
                Apis.instance()
                    .db_api()
                    .exec("get_required_fees", [operations, "1.3.0"])
            );
            promises.push(
                Apis.instance()
                    .db_api()
                    .exec("get_objects", [dynamicObjectIds])
            );
        }

        return Promise.all(promises).then(results => {
            /*
            * allFees and coreFees are arrays containg fee amounts grouped by
            * asset and for each operation in operations
            */
            let [allFees, coreFees, dynamicObjects] = results;
            /*
            * If one of the desired fee assets has an invalid core exchange rate
            * get_required_signatures will fail and the result for all assets
            * will be undefined, if so we just default to coreFees
            */
            if (allFees === undefined) {
                allFees = coreFees;
            }
            /*
            * If the only desired fee asset is CORE, coreFees are not fetched
            * but are equal to allFees
            */
            if (!coreFees) {
                coreFees = allFees[0];
            }

            /* Create a map of fees and proposal fees by asset id */
            let feesByAsset = {};
            let proposalFeesByAsset = {};
            allFees.forEach(feeSet => {
                let filteredFeeSet = feeSet.map(f => {
                    if (Array.isArray(f)) {
                        // This operation includes a proposal
                        proposalFeesByAsset[f[1][0].asset_id] = f[1];
                        return f[0];
                    }
                    return f;
                });
                let currentAssetId = filteredFeeSet[0].asset_id;

                feesByAsset[currentAssetId] = filteredFeeSet;
            }, {});

            /* Create a map of fee pools by asset id*/
            let feePoolMap = !!dynamicObjects
                ? dynamicObjects.reduce((map, object) => {
                      map[object.id.replace(/^2\./, "1.")] = object;
                      return map;
                  }, {})
                : {};

            let feeMap = {};
            let proposalFeeMap = {};
            function updateFeeMap(map, asset_id, opIndex, core_fees) {
                if (!map[asset_id]) map[asset_id] = {total: 0, ops: []};
                if (map[asset_id].propIdx) map[asset_id].propIdx.push(opIndex);
                else map[asset_id].ops.push(opIndex);

                if (asset_id !== "1.3.0") {
                    map[asset_id].total += core_fees.length
                        ? core_fees[opIndex].amount
                        : core_fees.amount;
                }
                return map;
            }

            for (let i = 0; i < operations.length; i++) {
                let op = operations[i];
                let feeAssetId = op[1].fee.asset_id;

                if (isProposal(op)) {
                    feeMap = updateFeeMap(
                        feeMap,
                        feeAssetId,
                        i,
                        coreFees[i][0]
                    );

                    op[1].proposed_ops.forEach((prop, y) => {
                        let propFeeAsset = prop.op[1].fee.asset_id;
                        if (!proposalFeeMap[i]) proposalFeeMap[i] = {};
                        if (!proposalFeeMap[i][propFeeAsset])
                            proposalFeeMap[i][propFeeAsset] = {
                                total: 0,
                                ops: [i],
                                propIdx: []
                            };

                        proposalFeeMap[i] = updateFeeMap(
                            proposalFeeMap[i],
                            propFeeAsset,
                            y,
                            coreFees[i][1]
                        );
                    });
                } else {
                    feeMap = updateFeeMap(feeMap, feeAssetId, i, coreFees[i]);
                }
            }

            /* Check fee pool balances for regular ops */
            function checkPoolBalance(feeMap) {
                if (!Object.keys(feeMap).length) return [];
                let final_fees = [];
                for (let asset in feeMap) {
                    let feePoolBalance = feePoolMap[asset]
                        ? parseInt(feePoolMap[asset].fee_pool, 10)
                        : 0;
                    /* Fee pool balance insufficient, default to core*/
                    if (feeMap[asset].total > feePoolBalance) {
                        feeMap[asset].ops.forEach(opIndex => {
                            if (
                                coreFees[opIndex].length === 2 &&
                                "propIdx" in feeMap[asset]
                            ) {
                                /* Proposal op */
                                feeMap[asset].propIdx.forEach(prop_idx => {
                                    final_fees[prop_idx] =
                                        coreFees[opIndex][1][prop_idx];
                                });
                            } else if (coreFees[opIndex].length === 2) {
                                final_fees[opIndex] = coreFees[opIndex][0];
                            } else {
                                final_fees[opIndex] = coreFees[opIndex];
                            }
                        });
                        /* Use the desired fee asset */
                    } else {
                        feeMap[asset].ops.forEach(opIndex => {
                            if (
                                coreFees[opIndex].length === 2 &&
                                "propIdx" in feeMap[asset]
                            ) {
                                feeMap[asset].propIdx.forEach(prop_idx => {
                                    final_fees[prop_idx] =
                                        proposalFeesByAsset[asset][prop_idx];
                                });
                            } else {
                                final_fees[opIndex] =
                                    feesByAsset[asset][opIndex];
                            }
                        });
                    }
                }
                return final_fees;
            }

            let finalFees = checkPoolBalance(feeMap);

            let finalProposalFees = {};
            for (let key in proposalFeeMap) {
                finalProposalFees[key] = checkPoolBalance(proposalFeeMap[key]);
            }

            let set_fee = (operation, opIndex) => {
                if (
                    !operation.fee ||
                    operation.fee.amount === 0 ||
                    (operation.fee.amount.toString &&
                        operation.fee.amount.toString() === "0") // Long
                ) {
                    if (removeDuplicates) {
                        let op = ops.operation.toObject(
                            this.operations[opIndex]
                        );
                        let originalIndex = getDuplicateOriginalIndex(
                            op,
                            opIndex
                        );
                        if (originalIndex >= 0) {
                            // it's a duplicate
                            operation.fee = finalFees[originalIndex];
                        } else {
                            operation.fee = finalFees[opIndex];
                        }
                    } else {
                        operation.fee = finalFees[opIndex];
                    }
                }
                if (operation.proposed_ops) {
                    let result = [];
                    /*
                    * Loop over proposed_ops and assign fee asset ids as
                    * determined by the fee pool balance check. If the balance
                    * is sufficient the asset_id is kept, if not it defaults to
                    * "1.3.0"
                    */
                    for (let y = 0; y < operation.proposed_ops.length; y++) {
                        operation.proposed_ops[y].op[1].fee.asset_id =
                            finalProposalFees[opIndex][y].asset_id;
                        operation.proposed_ops[y].op[1].fee.amount =
                            finalProposalFees[opIndex][y].amount;
                    }

                    return result;
                }
            };
            /* We apply the final fees the the operations */
            for (let i = 0; i < this.operations.length; i++) {
                set_fee(this.operations[i][1], i);
            }
        });
        //DEBUG console.log('... get_required_fees',operations,asset_id,flat_fees)
    }

    get_potential_signatures() {
        var tr_object = ops.signed_transaction.toObject(this);
        return Promise.all([
            Apis.instance()
                .db_api()
                .exec("get_potential_signatures", [tr_object]),
            Apis.instance()
                .db_api()
                .exec("get_potential_address_signatures", [tr_object])
        ]).then(function(results) {
            return {pubkeys: results[0], addys: results[1]};
        });
    }

    get_required_signatures(available_keys) {
        if (!available_keys.length) {
            return Promise.resolve([]);
        }
        var tr_object = ops.signed_transaction.toObject(this);
        //DEBUG console.log('... tr_object',tr_object)
        return Apis.instance()
            .db_api()
            .exec("get_required_signatures", [tr_object, available_keys])
            .then(function(required_public_keys) {
                //DEBUG console.log('... get_required_signatures',required_public_keys)
                return required_public_keys;
            });
    }

    add_signer(private_key, public_key = private_key.toPublicKey()) {
        assert(private_key.d, "required PrivateKey object");

        if (this.signed) {
            throw new Error("already signed");
        }
        if (!public_key.Q) {
            public_key = PublicKey.fromPublicKeyString(public_key);
        }
        // prevent duplicates
        let spHex = private_key.toHex();
        for (let sp of this.signer_private_keys) {
            if (sp[0].toHex() === spHex) return;
        }
        this.signer_private_keys.push([private_key, public_key]);
    }

    sign(chain_id = Apis.instance().chain_id) {
        if (!this.tr_buffer) {
            throw new Error("not finalized");
        }
        if (this.signed) {
            throw new Error("already signed");
        }
        if (!this.signer_private_keys.length) {
            throw new Error(
                "Transaction was not signed. Do you have a private key? [no_signers]"
            );
        }
        var end = this.signer_private_keys.length;
        for (var i = 0; 0 < end ? i < end : i > end; 0 < end ? i++ : i++) {
            var [private_key, public_key] = this.signer_private_keys[i];
            var sig = Signature.signBuffer(
                Buffer.concat([new Buffer(chain_id, "hex"), this.tr_buffer]),
                private_key,
                public_key
            );
            this.signatures.push(sig.toBuffer());
        }
        this.signer_private_keys = [];
        this.signed = true;
        return;
    }

    serialize() {
        return ops.signed_transaction.toObject(this);
    }

    toObject() {
        return ops.signed_transaction.toObject(this);
    }

    broadcast(was_broadcast_callback) {
        if (this.tr_buffer) {
            return this._broadcast(was_broadcast_callback);
        } else {
            return this.finalize().then(() => {
                return this._broadcast(was_broadcast_callback);
            });
        }
    }
}

var base_expiration_sec = () => {
    var head_block_sec = Math.ceil(getHeadBlockDate().getTime() / 1000);
    var now_sec = Math.ceil(Date.now() / 1000);
    // The head block time should be updated every 3 seconds.  If it isn't
    // then help the transaction to expire (use head_block_sec)
    if (now_sec - head_block_sec > 30) {
        return head_block_sec;
    }
    // If the user's clock is very far behind, use the head block time.
    return Math.max(now_sec, head_block_sec);
};

function _broadcast(was_broadcast_callback) {
    return new Promise((resolve, reject) => {
        if (!this.signed) {
            this.sign();
        }
        if (!this.tr_buffer) {
            throw new Error("not finalized");
        }
        if (!this.signatures.length) {
            throw new Error("not signed");
        }
        if (!this.operations.length) {
            throw new Error("no operations");
        }

        var tr_object = ops.signed_transaction.toObject(this);
        // console.log('... broadcast_transaction_with_callback !!!')
        Apis.instance()
            .network_api()
            .exec("broadcast_transaction_with_callback", [
                function(res) {
                    return resolve(res);
                },
                tr_object
            ])
            .then(function() {
                //console.log('... broadcast success, waiting for callback')
                if (was_broadcast_callback) was_broadcast_callback();
                return;
            })
            .catch(error => {
                // console.log may be redundant for network errors, other errors could occur
                var message = error.message;
                if (!message) {
                    message = "Unknown error";
                }
                error.digest = hash.sha256(this.tr_buffer).toString("hex");
                error.transaction = this.tr_buffer.toString("hex");
                console.log(error);
                reject(
                    new Error(
                        message +
                            "\n" +
                            JSON.stringify(error)
                    )
                );
                return;
            });
        return;
    });
}

function getHeadBlockDate() {
    return timeStringToDate(head_block_time_string);
}

function timeStringToDate(time_string) {
    if (!time_string) return new Date("1970-01-01T00:00:00.000Z");
    if (!/Z$/.test(time_string))
        //does not end in Z
        // https://github.com/cryptonomex/graphene/issues/368
        time_string = time_string + "Z";
    return new Date(time_string);
}

export default TransactionBuilder;
