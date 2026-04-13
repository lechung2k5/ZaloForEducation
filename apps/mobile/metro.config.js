const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Đường dẫn tới root của monorepo
const monorepoRoot = path.resolve(__dirname, '../..');

// Đường dẫn tới workspace này
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Thêm root monorepo vào watchFolders
// để Metro thấy được node_modules ở cấp trên
config.watchFolders = [monorepoRoot];

// Resolver tìm modules theo thứ tự:
// 1. node_modules của app (apps/mobile/node_modules)
// 2. node_modules của monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Đảm bảo Metro resolve đúng react-native từ root
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
