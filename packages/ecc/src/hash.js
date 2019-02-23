import createHash from "create-hash";
import createHmac from "create-hmac";

/** @arg {string|Buffer} data
    @arg {string} [digest = null] - 'hex', 'binary' or 'base64'
    @return {string|Buffer} - Buffer when digest is null, or string
*/
function sha1(data, encoding) {
    return createHash("sha1")
        .update(data)
        .digest(encoding);
}

/** @arg {string|Buffer} data
    @arg {string} [digest = null] - 'hex', 'binary' or 'base64'
    @return {string|Buffer} - Buffer when digest is null, or string
*/
function sha256(data, encoding) {
    return createHash("sha256")
        .update(data)
        .digest(encoding);
}

/** @arg {string|Buffer} data
    @arg {string} [digest = null] - 'hex', 'binary' or 'base64'
    @return {string|Buffer} - Buffer when digest is null, or string
*/
function sha512(data, encoding) {
    return createHash("sha512")
        .update(data)
        .digest(encoding);
}

function HmacSHA256(buffer, secret) {
    return createHmac("sha256", secret)
        .update(buffer)
        .digest();
}

function ripemd160(data) {
    return createHash("rmd160")
        .update(data)
        .digest();
}

// function hash160(buffer) {
//   return ripemd160(sha256(buffer))
// }
//
// function hash256(buffer) {
//   return sha256(sha256(buffer))
// }

//
// function HmacSHA512(buffer, secret) {
//   return crypto.createHmac('sha512', secret).update(buffer).digest()
// }

export {sha1, sha256, sha512, HmacSHA256, ripemd160};
