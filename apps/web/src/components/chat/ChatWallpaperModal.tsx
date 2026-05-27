import React from "react";
import { X, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import {
  getConversationWallpaperId,
  setConversationWallpaperId,
} from "../../utils/chatWallpapers";
import { CHAT_WALLPAPERS } from "../../utils/chatWallpapers";
import type { ChatWallpaperId } from "../../utils/chatWallpapers";
interface ChatWallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const { t, isDark } = useTheme();

  // Local state to keep track of selected wallpaper before saving
  const [selectedId, setSelectedId] = React.useState<ChatWallpaperId>(
    getConversationWallpaperId(conversationId)
  );

  React.useEffect(() => {
    if (isOpen) {
      setSelectedId(getConversationWallpaperId(conversationId));
    }
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const handleSave = () => {
    setConversationWallpaperId(conversationId, selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-surface-container rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
          <h2 className="text-[18px] font-extrabold text-on-surface">
            {t("wallpaper.modal_title")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh] hide-scrollbar grid grid-cols-2 md:grid-cols-3 gap-4">
          {CHAT_WALLPAPERS.map((wallpaper) => {
            const isSelected = selectedId === wallpaper.id;
            const bgUrl = isDark ? wallpaper.darkUrl : wallpaper.lightUrl;

            return (
              <button
                key={wallpaper.id}
                onClick={() => setSelectedId(wallpaper.id)}
                className={`group relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${isSelected
                    ? "border-primary shadow-[0_0_0_2px_rgba(var(--color-primary),0.3)]"
                    : "border-transparent hover:border-outline-variant/30"
                  }`}
              >
                <img
                  src={bgUrl}
                  alt={t(wallpaper.labelKey)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                  <span className="text-white font-semibold text-[13px] text-left drop-shadow-md">
                    {t(wallpaper.labelKey)}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-outline-variant/20 bg-surface-container/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-on-surface bg-surface-container-high hover:opacity-90 transition-opacity"
          >
            {t("wallpaper.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl font-bold text-[14px] text-white bg-primary hover:bg-primary/90 transition-opacity shadow-md hover:shadow-lg"
          >
            {t("wallpaper.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWallpaperModal;
