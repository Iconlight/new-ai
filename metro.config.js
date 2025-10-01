const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Resolve Node.js core modules to empty modules for React Native
// This prevents the ws package from trying to import Node.js modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // List of Node.js core modules that ws tries to import
  const nodeModules = [
    'http',
    'https',
    'net',
    'tls',
    'fs',
    'stream',
    'zlib',
    'crypto',
    'url',
    'buffer',
    'events',
  ];

  // If ws is trying to import a Node.js core module, return an empty module
  if (nodeModules.includes(moduleName)) {
    return {
      type: 'empty',
    };
  }

  // Otherwise, use the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
