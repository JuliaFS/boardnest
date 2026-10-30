const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's server renderer selects tslib's Node wrapper for GraphQL
// dependencies. Resolve the portable ESM build directly while preserving
// package exports for Expo Router and every other dependency.
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    context,
    moduleName === 'tslib' ? 'tslib/tslib.es6.mjs' : moduleName,
    platform,
  );

module.exports = config;
