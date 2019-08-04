import {localVariable} from "./utils";

/** tracks everyone who wants to receive updates when the cache changes */
export const subscribers = new Set();
export const clearSubscirbers = () => subscribers.clear();

export const subscribed = localVariable(false);

// progress = 0;
// chain_time_offset is used to estimate the blockchain time
export const chainTimeOffset = [];

export const dispatchFrequency = localVariable(40);

export const subbed = {
    accounts: new Set(),
    witnesses: new Set(),
    committee: new Set()
};

export const objectById = new Map();

export const accountsByName = new Map();
export const assetsBySymbol = new Map();
export const accountIdsByKey = new Map(); //Immutable.Map();
export const accountIdsByAccount = new Map(); //Immutable.Map();
export const balanceObjectsByAddress = new Map();
export const getAccountRefsOfKeysCalls = new Set();
export const getAccountRefsOfAccountsCalls = new Set();
export const accountHistoryRequests = new Map();
export const witnessByAccountId = new Map();
export const workers = new Set();
export const committeeByAccountId = new Map();
export const objectsByVoteId = new Map();
export const fetchingGetFullAccounts = new Map();
export const getFullAccountsSubscriptions = new Map();

export const timeout = localVariable();
export const dispatched = localVariable();
export const subError = localVariable();
export const headBlockTimeString = localVariable(null);

/**
 * Clears all cached state.  This should be called any time the network connection is
 * reset.
 */
export const clearCache = () => {
    /*
     * Tracks specific objects such as accounts that can trigger additional
     * fetching that should only happen if we're actually interested in the account
     */
    subbed.accounts.clear();
    subbed.witnesses.clear();
    subbed.committee.clear();

    objectById.clear();
    accountsByName.clear();
    assetsBySymbol.clear();
    accountIdsByKey.clear(); //= Immutable.Map();
    accountIdsByAccount.clear(); //= Immutable.Map();

    balanceObjectsByAddress.clear();
    getAccountRefsOfKeysCalls.clear();
    getAccountRefsOfAccountsCalls.clear();
    accountHistoryRequests.clear(); ///< tracks pending history requests
    witnessByAccountId.clear();
    workers.clear();
    committeeByAccountId.clear();
    objectsByVoteId.clear();
    fetchingGetFullAccounts.clear();
    getFullAccountsSubscriptions.clear();
    clearTimeout(timeout.get());
    dispatched.set(false);
};
