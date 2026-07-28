// Expo monorepo config: lets Metro resolve @skillapp-core/ui straight from
// its TypeScript source in ../../../packages/skillapp-core-ui via the npm
// workspace, instead of requiring a separate build step for that package.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
