let ChainTypes = {};

ChainTypes.reserved_spaces = {
    relative_protocol_ids: 0,
    protocol_ids: 1,
    implementation_ids: 2
};

ChainTypes.object_type = {
    null: 0,
    base: 1,
    account: 2,
    asset: 3,
    force_settlement: 4,
    committee_member: 5,
    witness: 6,
    limit_order: 7,
    call_order: 8,
    custom: 9,
    proposal: 10,
    operation_history: 11,
    withdraw_permission: 12,
    vesting_balance: 13,
    worker: 14,
    balance: 15,
    htlc: 16,
    custom_active_authorities: 17, // TODO: not active on the main net.
    ticket: 18,
    liquidity_pool: 19
};

ChainTypes.impl_object_type = {
    global_property: 0,
    dynamic_global_property: 1,
    index_meta: 2,
    asset_dynamic_data: 3,
    asset_bitasset_data: 4,
    account_balance: 5,
    account_statistics: 6,
    transaction: 7,
    block_summary: 8,
    account_transaction_history: 9,
    blinded_balance: 10,
    chain_property: 11,
    witness_schedule: 12,
    budget_record: 13
};

ChainTypes.vote_type = {
    committee: 0,
    witness: 1,
    worker: 2
};

ChainTypes.operations = {
    transfer: 0,
    limit_order_create: 1,
    limit_order_cancel: 2,
    call_order_update: 3,
    fill_order: 4,
    account_create: 5,
    account_update: 6,
    account_whitelist: 7,
    account_upgrade: 8,
    account_transfer: 9,
    asset_create: 10,
    asset_update: 11,
    asset_update_bitasset: 12,
    asset_update_feed_producers: 13,
    asset_issue: 14,
    asset_reserve: 15,
    asset_fund_fee_pool: 16,
    asset_settle: 17,
    asset_global_settle: 18,
    asset_publish_feed: 19,
    witness_create: 20,
    witness_update: 21,
    proposal_create: 22,
    proposal_update: 23,
    proposal_delete: 24,
    withdraw_permission_create: 25,
    withdraw_permission_update: 26,
    withdraw_permission_claim: 27,
    withdraw_permission_delete: 28,
    committee_member_create: 29,
    committee_member_update: 30,
    committee_member_update_global_parameters: 31,
    vesting_balance_create: 32,
    vesting_balance_withdraw: 33,
    worker_create: 34,
    custom: 35,
    assert: 36,
    balance_claim: 37,
    override_transfer: 38,
    transfer_to_blind: 39,
    blind_transfer: 40,
    transfer_from_blind: 41,
    asset_settle_cancel: 42,
    asset_claim_fees: 43,
    fba_distribute: 44,
    bid_collateral: 45,
    execute_bid: 46,
    asset_claim_pool: 47,
    asset_update_issuer: 48,
    htlc_create: 49,
    htlc_redeem: 50,
    htlc_redeemed: 51,
    htlc_extend: 52,
    htlc_refund: 53,
    custom_authority_create: 54,
    custom_authority_update: 55,
    custom_authority_delete: 56,
    ticket_create: 57,
    ticket_update: 58,
    liquidity_pool_create: 59,
    liquidity_pool_delete: 60,
    liquidity_pool_deposit: 61,
    liquidity_pool_withdraw: 62,
    liquidity_pool_exchange: 63
};

ChainTypes.ticket_type = {
    liquid: 0,
    lock_180_days: 1,
    lock_360_days: 2,
    lock_720_days: 3,
    lock_forever: 4
};

export default ChainTypes;
