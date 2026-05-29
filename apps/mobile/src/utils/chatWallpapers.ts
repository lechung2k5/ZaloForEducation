import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatWallpaperId =
  | 'study-meadow'
  | 'math-orbit'
  | 'library-horizon'
  | 'science-lab'
  | 'world-classroom';

export type ChatWallpaper = {
  id: ChatWallpaperId;
  label: string;
  lightSource: any;
  darkSource: any;
};

const WALLPAPER_STORAGE_KEY = 'chat_conversation_wallpapers';

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: 'study-meadow',
    label: '\u0110\u1ed3ng c\u1ecf h\u1ecdc t\u1eadp',
    lightSource: require('../../assets/background/chat-wallpapers/study-meadow-light.webp'),
    darkSource: require('../../assets/background/chat-wallpapers/study-meadow-dark.webp'),
  },
  {
    id: 'math-orbit',
    label: 'Qu\u1ef9 \u0111\u1ea1o to\u00e1n h\u1ecdc',
    lightSource: require('../../assets/background/chat-wallpapers/math-orbit-light.webp'),
    darkSource: require('../../assets/background/chat-wallpapers/math-orbit-dark.webp'),
  },
  {
    id: 'library-horizon',
    label: 'Ch\u00e2n tr\u1eddi th\u01b0 vi\u1ec7n',
    lightSource: require('../../assets/background/chat-wallpapers/library-horizon-light.webp'),
    darkSource: require('../../assets/background/chat-wallpapers/library-horizon-dark.webp'),
  },
  {
    id: 'science-lab',
    label: 'Ph\u00f2ng th\u00ed nghi\u1ec7m',
    lightSource: require('../../assets/background/chat-wallpapers/science-lab-light.webp'),
    darkSource: require('../../assets/background/chat-wallpapers/science-lab-dark.webp'),
  },
  {
    id: 'world-classroom',
    label: 'L\u1edbp h\u1ecdc th\u1ebf gi\u1edbi',
    lightSource: require('../../assets/background/chat-wallpapers/world-classroom-light.webp'),
    darkSource: require('../../assets/background/chat-wallpapers/world-classroom-dark.webp'),
  },
];

export const DEFAULT_CHAT_WALLPAPER_ID: ChatWallpaperId = 'study-meadow';

const isChatWallpaperId = (value: any): value is ChatWallpaperId =>
  CHAT_WALLPAPERS.some((wallpaper) => wallpaper.id === value);

const readWallpaperMap = async (): Promise<Record<string, ChatWallpaperId>> => {
  try {
    const parsed = JSON.parse(await AsyncStorage.getItem(WALLPAPER_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getConversationWallpaperId = async (
  convId?: string | null,
): Promise<ChatWallpaperId> => {
  if (!convId) return DEFAULT_CHAT_WALLPAPER_ID;
  const stored = (await readWallpaperMap())[convId];
  return isChatWallpaperId(stored) ? stored : DEFAULT_CHAT_WALLPAPER_ID;
};

export const setConversationWallpaperId = async (
  convId: string,
  wallpaperId: ChatWallpaperId,
) => {
  const map = await readWallpaperMap();
  map[convId] = wallpaperId;
  await AsyncStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(map));
};

export const getChatWallpaper = (wallpaperId: ChatWallpaperId) =>
  CHAT_WALLPAPERS.find((wallpaper) => wallpaper.id === wallpaperId) ||
  CHAT_WALLPAPERS[0];

export const getChatWallpaperSource = (
  wallpaperId: ChatWallpaperId,
  isDark = false,
) => {
  const wallpaper = getChatWallpaper(wallpaperId);
  return isDark ? wallpaper.darkSource : wallpaper.lightSource;
};
