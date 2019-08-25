export const getAccountMemberStatus = account => {
    if (account === undefined) return undefined;
    if (account === null) return "unknown";
    if (account.get("lifetime_referrer") == account.get("id"))
        return "lifetime";
    let exp = new Date(account.get("membership_expiration_date")).getTime();
    let now = new Date().getTime();
    if (exp < now) return "basic";
    return "annual";
};
