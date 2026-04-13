module.exports = {
    '**/*.ts?(x)': () => ['yarn type:check'],
    // Run Biome on staged files that have the following extensions: js, ts, jsx, tsx, json and jsonc
    '*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}': [
        'biome check --write --unsafe --no-errors-on-unmatched', // Format, sort imports, lints, apply safe/unsafe fixes
    ],
    // Alternatively you can pass every files and ignore unknown extensions
    '*': [
        'biome check --no-errors-on-unmatched --files-ignore-unknown=true', // Check formatting and lint
    ],
}
