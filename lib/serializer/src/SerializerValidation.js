import {Long} from "bytebuffer";
import ChainTypes from "../../chain/src/ChainTypes";

var MAX_SAFE_INT = 9007199254740991;
var MIN_SAFE_INT = -9007199254740991;

/**
    Most validations are skipped and the value returned unchanged when an empty string, null, or undefined is encountered (except "required").

    Validations support a string format for dealing with large numbers.
*/
var _my = {
    is_empty: function(value) {
        return value === null || value === undefined;
    },

    required(value, field_name = "") {
        if (this.is_empty(value)) {
            throw new Error(`value required ${field_name} ${value}`);
        }
        return value;
    },
    require_array: function(value, instance_require) {
        if ( !( value instanceof Array) ) {
            throw new Error(`array required`);
        }
        if( instance_require ){
            value.forEach( i =>{
                instance_require(i);
            })
        }
        return value;
    },
    require_long(value, field_name = "") {
        if (!Long.isLong(value)) {
            throw new Error(`Long value required ${field_name} ${value}`);
        }
        return value;
    },

    string(value) {
        if (this.is_empty(value)) {
            return value;
        }
        if (typeof value !== "string") {
            throw new Error(`string required: ${value}`);
        }
        return value;
    },

    number(value) {
        if (this.is_empty(value)) {
            return value;
        }
        if (typeof value !== "number") {
            throw new Error(`number required: ${value}`);
        }
        return value;
    },

    whole_number(value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        if (/\./.test(value)) {
            throw new Error(`whole number required ${field_name} ${value}`);
        }
        return value;
    },

    unsigned(value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        if (/-/.test(value)) {
            throw new Error(`unsigned required ${field_name} ${value}`);
        }
        return value;
    },

    is_digits: function(value) {
        if (typeof value === "numeric") {
            return true;
        }
        return /^[0-9]+$/.test(value);
    },

    to_number: function(value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        this.no_overflow53(value, field_name);
        var int_value = (() => {
            if (typeof value === "number") {
                return value;
            } else {
                return parseInt(value);
            }
        })();
        return int_value;
    },

    to_long(value, field_name = "", unsigned = false) {
        if (this.is_empty(value)) {
            return value;
        }
        if (Long.isLong(value)) {
            return value;
        }

        this.no_overflow64(value, field_name, unsigned);
        // BigInteger#isBigInteger https://github.com/cryptocoinjs/bigi/issues/20
        // (code copied from no_overflow64)
        if (value.t !== undefined && value.s !== undefined) {
            value = value.toString();
        }
        if (typeof value === "number") {
            value = "" + value;
        }
        value = value.trim();
        var long_value = Long.fromString(value, unsigned);
        if (long_value.toString() !== value) {
            throw new Error(`Unable to safely convert ${field_name} ${value} to long`);
        }
        return long_value;
    },

    to_string(value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        if (typeof value === "string") {
            return value;
        }
        if (typeof value === "number") {
            this.no_overflow53(value, field_name);
            return "" + value;
        }
        if (Long.isLong(value)) {
            return value.toString();
        }
        throw `unsupported type ${field_name}: (${typeof value}) ${value}`;
    },

    require_test(regex, value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        if (!regex.test(value)) {
            throw new Error(`unmatched ${regex} ${field_name} ${value}`);
        }
        return value;
    },

    require_match: function(regex, value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        var match = value.match(regex);
        if (match === null) {
            throw new Error(`unmatched ${regex} ${field_name} ${value}`);
        }
        return match;
    },

    require_object_id: function(value, field_name) {
        return require_match(
            /^([0-9]+)\.([0-9]+)\.([0-9]+)$/,
            value,
            field_name
        );
    },

    // Does not support over 53 bits
    require_range(min, max, value, field_name = "") {
        if (this.is_empty(value)) {
            return value;
        }
        var number = this.to_number(value);
        if (value < min || value > max) {
            throw new Error(`out of range ${value} ${field_name} ${value}`);
        }
        return value;
    },

    require_object_type: function(
        reserved_spaces = 1,
        type,
        value,
        field_name = ""
    ) {
        if (this.is_empty(value)) {
            return value;
        }
        var object_type = ChainTypes.object_type[type];
        if (!object_type) {
            throw new Error(
                `Unknown object type ${type} ${field_name} ${value}`
            );
        }
        var re = new RegExp(`${reserved_spaces}\.${object_type}\.[0-9]+$`);
        if (!re.test(value)) {
            throw new Error(
                `Expecting ${type} in format ` +
                    `${reserved_spaces}.${object_type}.[0-9]+ ` +
                    `instead of ${value} ${field_name} ${value}`
            );
        }
        return value;
    },

    get_instance: function(reserve_spaces, type, value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        this.require_object_type(reserve_spaces, type, value, field_name);
        return this.to_number(value.split(".")[2]);
    },

    require_relative_type: function(type, value, field_name) {
        this.require_object_type(0, type, value, field_name);
        return value;
    },

    get_relative_instance: function(type, value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        this.require_object_type(0, type, value, field_name);
        return this.to_number(value.split(".")[2]);
    },

    require_protocol_type: function(type, value, field_name) {
        this.require_object_type(1, type, value, field_name);
        return value;
    },

    get_protocol_instance: function(type, value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        this.require_object_type(1, type, value, field_name);
        return this.to_number(value.split(".")[2]);
    },

    get_protocol_type: function(value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        this.require_object_id(value, field_name);
        var values = value.split(".");
        return this.to_number(values[1]);
    },

    get_protocol_type_name(value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        var type_id = this.get_protocol_type(value, field_name);
        return Object.keys(ChainTypes.object_type)[type_id];
    },

    require_implementation_type: function(type, value, field_name) {
        this.require_object_type(2, type, value, field_name);
        return value;
    },

    get_implementation_instance: function(type, value, field_name) {
        if (this.is_empty(value)) {
            return value;
        }
        this.require_object_type(2, type, value, field_name);
        return this.to_number(value.split(".")[2]);
    },

    // signed / unsigned decimal
    no_overflow53(value, field_name = "") {
        if (typeof value === "number") {
            if (value > MAX_SAFE_INT || value < MIN_SAFE_INT) {
                throw new Error(`overflow ${field_name} ${value}`);
            }
            return;
        }
        if (typeof value === "string") {
            var int = parseInt(value);
            if (value > MAX_SAFE_INT || value < MIN_SAFE_INT) {
                throw new Error(`overflow ${field_name} ${value}`);
            }
            return;
        }
        if (Long.isLong(value)) {
            // typeof value.toInt() is 'number'
            this.no_overflow53(value.toInt(), field_name);
            return;
        }
        throw `unsupported type ${field_name}: (${typeof value}) ${value}`;
    },

    // signed / unsigned whole numbers only
    no_overflow64(value, field_name = "", unsigned = false) {
        // https://github.com/dcodeIO/Long.js/issues/20
        if (Long.isLong(value)) {
            return;
        }

        // BigInteger#isBigInteger https://github.com/cryptocoinjs/bigi/issues/20
        if (value.t !== undefined && value.s !== undefined) {
            this.no_overflow64(value.toString(), field_name, unsigned);
            return;
        }

        if (typeof value === "string") {
            // remove leading zeros, will cause a false positive
            value = value.replace(/^0+/, "");
            // remove trailing zeros
            while (/0$/.test(value)) {
                value = value.substring(0, value.length - 1);
            }
            if (/\.$/.test(value)) {
                // remove trailing dot
                value = value.substring(0, value.length - 1);
            }
            if (value === "") {
                value = "0";
            }
            var long_string = Long.fromString(value, unsigned).toString();
            if (long_string !== value.trim()) {
                throw new Error(`overflow ${field_name} ${value}`);
            }
            return;
        }
        if (typeof value === "number") {
            if (value > MAX_SAFE_INT || value < MIN_SAFE_INT) {
                throw new Error(`overflow ${field_name} ${value}`);
            }
            return;
        }

        throw `unsupported type ${field_name}: (${typeof value}) ${value}`;
    }
};

export default _my;
