const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add extra node modules that need to be resolved as empty
config.resolver.extraNodeModules = {
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('expo-crypto'),
  url: require.resolve('url'),
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  // Server-only modules that should be empty
  net: false,
  tls: false,
  fs: false,
  zlib: false,
  dns: false,
  child_process: false,
  readline: false,
  repl: false,
};

module.exports = config;
