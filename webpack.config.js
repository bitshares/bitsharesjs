var path = require("path");

module.exports = {
    entry: "./dist/index.js",
    mode: "production",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "bitsharesjs.cjs",
        libraryTarget: "commonjs"
    },
    resolve:{
        fallback: { "stream": require.resolve("stream-browserify") }
    }
};
