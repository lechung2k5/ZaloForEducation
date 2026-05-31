const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// 1. Xác định các đường dẫn root
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// 2. Khởi tạo config mặc định từ Expo
const config = getDefaultConfig(projectRoot);

// 3. Monorepo: Theo dõi toàn bộ thư mục root để thấy node_modules chung
config.watchFolders = [monorepoRoot];

// 4. Resolver: Ưu tiên tìm modules trong app rồi mới lên root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 5. [SENIOR FIX] BlockList - Né các thư mục rác gây lỗi ENOENT trên Windows
config.resolver.blockList = [
  /.*\.gradle.*/,
  /.*node_modules\/.*\/build\/.*/,
  /.*node_modules\/.*\/ios\/.*/,
  /.*node_modules\/.*\/android\/.*/,
  /.*\.expo-.*/,
];

// 6. Đảm bảo hỗ trợ New Architecture nếu cần
config.resolver.disableHierarchicalLookup = false;

// 7. [WEB FIX] Swap react-native-webrtc → web mock khi chạy trên browser.
//    react-native-webrtc dùng requireNativeComponent, không tồn tại trên browser.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webrtc' && platform === 'web') {
    return {
      filePath: path.resolve(projectRoot, 'src/mocks/react-native-webrtc.web.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
