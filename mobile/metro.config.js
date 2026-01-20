const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow importing shared JS files from the repo root (e.g. ../shared/descriptors.js)
config.watchFolders = [path.resolve(__dirname, "..")];

module.exports = config;

