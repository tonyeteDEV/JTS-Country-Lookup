// Bundling React + Fluent UI v9 directly (instead of relying on platform-library) hits a
// webpack5 "fully specified ESM" resolution error: @griffel/react's ESM entry imports the bare
// specifier `react/jsx-runtime` with no extension, which webpack refuses to resolve once it's
// treating that file as strict ESM. React only ships `jsx-runtime.js` (with the extension), so
// alias the bare specifiers straight to the real files instead of disabling package `exports`
// resolution globally - that would also turn off tree-shaking and bloat the bundle by 10x+.
const path = require("path");

module.exports = {
    resolve: {
        alias: {
            "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
            "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime.js"),
        },
    },
    performance: {
        hints: false,
        maxAssetSize: 1024 * 1024,
        maxEntrypointSize: 1024 * 1024,
    },
};
