function get(state) {
    return function(key) {
        return state[key] || "";
    };
}

function set(state) {
    return function(key, value) {
        state[key] = value;
        return this;
    };
}

export { get, set };
