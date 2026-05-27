export type ChatWallpaperId =
  | "study-meadow"
  | "math-orbit"
  | "library-horizon"
  | "science-lab"
  | "world-classroom";

export type ChatWallpaper = {
  id: ChatWallpaperId;
  labelKey: string;
  lightUrl: string;
  darkUrl: string;
};

const WALLPAPER_STORAGE_KEY = "chat_conversation_wallpapers";
export const CHAT_WALLPAPER_CHANGED_EVENT = "chat-wallpaper-changed";

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: "study-meadow",
    labelKey: "wallpaper.study_meadow",
    lightUrl: "/background/chat-wallpapers/study-meadow-light.webp",
    darkUrl: "/background/chat-wallpapers/study-meadow-dark.webp",
  },
  {
    id: "math-orbit",
    labelKey: "wallpaper.math_orbit",
    lightUrl: "/background/chat-wallpapers/math-orbit-light.webp",
    darkUrl: "/background/chat-wallpapers/math-orbit-dark.webp",
  },
  {
    id: "library-horizon",
    labelKey: "wallpaper.library_horizon",
    lightUrl: "/background/chat-wallpapers/library-horizon-light.webp",
    darkUrl: "/background/chat-wallpapers/library-horizon-dark.webp",
  },
  {
    id: "science-lab",
    labelKey: "wallpaper.science_lab",
    lightUrl: "/background/chat-wallpapers/science-lab-light.webp",
    darkUrl: "/background/chat-wallpapers/science-lab-dark.webp",
  },
  {
    id: "world-classroom",
    labelKey: "wallpaper.world_classroom",
    lightUrl: "/background/chat-wallpapers/world-classroom-light.webp",
    darkUrl: "/background/chat-wallpapers/world-classroom-dark.webp",
  },
];

export const DEFAULT_CHAT_WALLPAPER_ID: ChatWallpaperId = "study-meadow";

const readWallpaperMap = (): Record<string, ChatWallpaperId> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WALLPAPER_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeWallpaperMap = (map: Record<string, ChatWallpaperId>) => {
  localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(map));
};

export const getConversationWallpaperId = (convId?: string | null): ChatWallpaperId => {
  if (!convId) return DEFAULT_CHAT_WALLPAPER_ID;
  const stored = readWallpaperMap()[convId];
  return CHAT_WALLPAPERS.some((wallpaper) => wallpaper.id === stored)
    ? stored
    : DEFAULT_CHAT_WALLPAPER_ID;
};

export const setConversationWallpaperId = (
  convId: string,
  wallpaperId: ChatWallpaperId,
) => {
  const map = readWallpaperMap();
  map[convId] = wallpaperId;
  writeWallpaperMap(map);
  window.dispatchEvent(
    new CustomEvent(CHAT_WALLPAPER_CHANGED_EVENT, {
      detail: { convId, wallpaperId },
    }),
  );
};

export const getChatWallpaper = (wallpaperId: ChatWallpaperId) =>
  CHAT_WALLPAPERS.find((wallpaper) => wallpaper.id === wallpaperId) ||
  CHAT_WALLPAPERS[0];

export const getChatWallpaperUrl = (
  wallpaperId: ChatWallpaperId,
  isDark: boolean,
) => {
  const wallpaper = getChatWallpaper(wallpaperId);
  return isDark ? wallpaper.darkUrl : wallpaper.lightUrl;
};
