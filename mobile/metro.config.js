// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle the raw TensorFlow.js model weight files (.bin)
// as standard assets so they work fully offline once bundled into the app.
config.resolver.assetExts.push('bin');

module.exports = config;
