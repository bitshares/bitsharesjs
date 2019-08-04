import ChainTypes from "../ChainTypes";

const {object_type, impl_object_type} = ChainTypes;

const WITNESS_OBJECT_TYPE = parseInt(object_type.witness, 10);
const COMMITTEE_MEMBER_OBJECT_TYPE = parseInt(object_type.committee_member, 10);
const ACCOUNT_OBJECT_TYPE = parseInt(object_type.account, 10);

export const OP_HISTORY = parseInt(object_type.operation_history, 10);
export const WITNESS_PREFIX = "1." + WITNESS_OBJECT_TYPE + ".";
export const COMMITTEE_PREFIX = "1." + COMMITTEE_MEMBER_OBJECT_TYPE + ".";
export const ACCOUNT_PREFIX = "1." + ACCOUNT_OBJECT_TYPE + ".";

export const DEFAULT_AUTO_SUBSCRIBE = true;

export const DEBUG = JSON.parse(
    process.env.npm_config__graphene_chain_chain_debug || false
);

const objectTypesArray = Object.keys(object_type);
const implObjectTypesArray = Object.keys(impl_object_type);

export const getObjectType = id => {
    let [one, two] = id.split(".");
    two = parseInt(two, 10);
    switch (one) {
        case "0":
            return "unknown";
        case "1":
            return objectTypesArray[two];
        case "2":
            return implObjectTypesArray[two];
        case "5":
            return "market";
        default:
    }
};

export const timeStringToDate = timeString => {
    if (!timeString) return new Date(0); //1970-01-01T00:00:00.000Z
    if (!/Z$/.test(timeString)) {
        //does not end in Z
        // https://github.com/cryptonomex/graphene/issues/368
        timeString += "Z";
    }
    return new Date(timeString);
};

export const localVariable = initVal => {
    let local = initVal;
    return {
        get: () => local,
        set: newVal => (local = newVal)
    };
};
