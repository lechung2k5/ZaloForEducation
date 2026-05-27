import React from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../../store/chatStore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  getDisplayName,
  getDisplayAvatar,
  DEFAULT_GROUP_AVATAR,
} from "../../utils/chatUtils";
import { useCallActions } from "../../hooks/useCallActions";
import { Search, Video, Phone, PanelRightOpen, X, Loader2, VideoIcon } from "lucide-react";
import { useGroupCallStore } from "../../store/groupCallStore";

import PinnedHeader from "./PinnedHeader";

interface ChatHeaderProps {
  onToggleInfo: () => void;
  isInfoOpen: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleInfo,
  isInfoOpen,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTheme();
  const {
    conversations,
    activeConvId,
    userProfiles,
    loadUserProfile,
    searchMessages,
    searchResults,
    isLocalSearching,
    clearSearchResults,
    jumpToMessage,
  } = useChatStore();
  const { startCall } = useCallActions();

  const [isSearchBarOpen, setIsSearchBarOpen] = React.useState(false);
  const [localSearchQuery, setLocalSearchQuery] = React.useState("");
  const { activeCallForConv, setActiveCallForConv, checkActiveCall, callState, joinMeeting } = useGroupCallStore();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keep focus on input even when store updates
  React.useEffect(() => {
    if (isSearchBarOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchBarOpen, isLocalSearching]); // Re-focus if it somehow loses it during searching

  const activeChat = conversations.find((c) => c.id === activeConvId);

  const partnerEmail =
    activeChat?.type === "direct"
      ? Array.isArray(activeChat.members)
        ? activeChat.members.find((m) => {
            const normalizedM = String(m || "")
              .trim()
              .toLowerCase();
            const normalizedMe = String(user?.email || "")
              .trim()
              .toLowerCase();
            return normalizedM !== normalizedMe;
          })
        : undefined
      : undefined;

  // [SENIOR] All hooks MUST be at the top level, before any early returns.
  React.useEffect(() => {
    if (partnerEmail) {
      loadUserProfile(partnerEmail);
    }
  }, [partnerEmail, loadUserProfile]);

  // [SENIOR] Debounced search logic to save resources
  React.useEffect(() => {
    const q = localSearchQuery.trim();
    if (q.length >= 2 && activeConvId) {
      const timer = setTimeout(() => {
        searchMessages(activeConvId, q);
      }, 400); // 400ms delay
      return () => clearTimeout(timer);
    } else if (q.length < 2) {
      clearSearchResults();
    }
  }, [localSearchQuery, activeConvId, searchMessages, clearSearchResults]);

  // Auto-close search when switching conversations
  const handleCloseSearch = React.useCallback(() => {
    setIsSearchBarOpen(false);
    setLocalSearchQuery("");
    clearSearchResults();
  }, [clearSearchResults]);

  React.useEffect(() => {
    handleCloseSearch();
    if (activeConvId && activeChat?.type === 'group') {
      checkActiveCall(activeConvId);
    }
  }, [activeConvId, handleCloseSearch, checkActiveCall, activeChat?.type]);

  // [PREMIUM] Real-time socket listener for active group calls
  React.useEffect(() => {
    const socket = (window as any).socket;
    if (!socket || !activeConvId) return;

    const handleActive = (data: any) => {
      if (data.convId === activeConvId) {
        // Optimistically set active call
        setActiveCallForConv({
          callId: data.callId,
          callType: data.callType,
          participantCount: 1 // Initially 1 (the caller)
        });
      }
    };

    const handleEnded = (data: any) => {
      if (data.convId === activeConvId) {
        setActiveCallForConv(null);
      }
    };

    socket.on('group-call:active', handleActive);
    socket.on('group-call:ended', handleEnded);

    return () => {
      socket.off('group-call:active', handleActive);
      socket.off('group-call:ended', handleEnded);
    };
  }, [activeConvId, setActiveCallForConv]);

  // [FIX] Now we can return early after all hooks are declared
  if (activeConvId && !activeChat) {
    console.debug(`[ChatHeader] Showing skeleton for: ${activeConvId}`);
    return (
      <header className="h-16 flex items-center px-6 bg-white/90 dark:bg-surface-container/90 backdrop-blur-xl border-b border-outline-variant/15 shrink-0 w-full">
        <div className="flex items-center gap-4 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-surface-container" />
          <div className="flex flex-col gap-2">
            <div className="w-32 h-4 bg-surface-container rounded" />
            <div className="w-20 h-3 bg-surface-container rounded" />
          </div>
        </div>
      </header>
    );
  }

  if (!activeConvId || !activeChat) {
    console.debug(`[ChatHeader] Returning NULL. activeConvId=${activeConvId}, activeChat=${!!activeChat}`);
    return null;
  }

  const chatName =
    activeChat.type === "direct"
      ? getDisplayName(partnerEmail, user, userProfiles)
      : activeChat.name || "Group";

  const chatAvatar =
    activeChat.type === "direct"
      ? getDisplayAvatar(partnerEmail, user, userProfiles)
      : activeChat.avatar || DEFAULT_GROUP_AVATAR;

  const normalizedPartner = partnerEmail
    ? String(partnerEmail).trim().toLowerCase()
    : "";
  const isOnline = normalizedPartner
    ? userProfiles[normalizedPartner]?.status === "online"
    : false;
  
  const isBot = normalizedPartner === 'bot@zaloedu.system';

  const handleOpenProfile = () => {
    if (!partnerEmail) return;
    navigate(`/profile?email=${encodeURIComponent(partnerEmail)}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  };

  return (
    <div className="relative flex flex-col shrink-0 z-30">
      <header className="h-16 flex items-center justify-between px-6 bg-white/90 dark:bg-surface-container/90 backdrop-blur-xl border-b border-outline-variant/15 dark:border-outline-variant/30 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          {isSearchBarOpen ? (
            <div className="flex-1 flex items-center bg-surface-container rounded-xl px-3 py-1.5 animate-in slide-in-from-left-4 duration-300">
              <Search size={18} className="text-on-surface-variant shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={localSearchQuery}
                onChange={handleSearchChange}
                placeholder={t('header.search_messages')}
                className="flex-1 bg-transparent border-none outline-none px-3 text-[14px] text-on-surface"
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleCloseSearch();
                }}
              />
              <button
                onClick={handleCloseSearch}
                className="p-1 hover:bg-surface-container-highest rounded-full transition-colors text-on-surface-variant"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <>
              <div
                className={`relative group ${partnerEmail ? "cursor-pointer" : ""}`}
                onClick={handleOpenProfile}
                title={partnerEmail ? t('header.view_profile') : undefined}
              >
                <img
                  className="w-11 h-11 rounded-full object-cover bg-surface-container ring-2 ring-white dark:ring-surface-container-high shadow-sm group-hover:ring-primary/20 transition-all"
                  alt=""
                  src={chatAvatar}
                />
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-surface-container rounded-full shadow-sm animate-pulse"></div>
                )}
              </div>
              <div className="flex flex-col">
                <h2 className="font-extrabold text-on-surface leading-tight text-[16px] tracking-tight">
                  {chatName}
                </h2>
                <p className="text-[12px] text-on-surface-variant font-bold flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-outline/40"}`}
                  ></span>
                  {activeChat.type === "group"
                    ? t('header.members_count', { count: activeChat.members?.length || 0 })
                    : isOnline
                      ? t('header.active')
                      : t('header.offline')}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isSearchBarOpen && (
            <button
              onClick={() => setIsSearchBarOpen(true)}
              className="w-10 h-10 flex items-center justify-center hover:bg-surface-container rounded-full transition-all text-on-surface-variant hover:text-primary"
            >
              <Search size={20} />
            </button>
          )}
          {!isBot && (
            <>
              <button
                onClick={() => startCall("video")}
                disabled={activeChat.type === "system"}
                title={activeChat.type === "group" ? t('header.video_call_group') : t('header.video_call_direct')}
                className="w-10 h-10 flex items-center justify-center hover:bg-surface-container rounded-full transition-all text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Video size={20} />
              </button>
              <button
                onClick={() => startCall("audio")}
                disabled={activeChat.type === "system"}
                title={activeChat.type === "group" ? t('header.voice_call_group') : t('header.voice_call_direct')}
                className="w-10 h-10 flex items-center justify-center hover:bg-surface-container rounded-full transition-all text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Phone size={20} />
              </button>
            </>
          )}

          <div className="w-px h-6 bg-outline-variant/20 mx-1" />
          <button
            onClick={onToggleInfo}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isInfoOpen ? "bg-primary/10 text-primary" : "hover:bg-surface-container text-on-surface-variant hover:text-primary"}`}
          >
            <PanelRightOpen size={20} />
          </button>
        </div>
      </header>

      {/* [PREMIUM] Banner: Active Group Call Indicator (Real-time & Prominent) */}
      {activeChat.type === "group" && activeCallForConv && callState === 'IDLE' && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-6 py-3 flex items-center justify-between shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 animate-pulse">
              <VideoIcon size={20} className="fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-green-600 dark:text-green-400">
                Đang có cuộc gọi nhóm diễn ra
              </span>
              <span className="text-[12px] text-green-600/70 dark:text-green-400/70 font-medium">
                Hãy nhấn tham gia để kết nối cùng mọi người
              </span>
            </div>
          </div>
          <button
            onClick={() => joinMeeting(activeConvId!, activeCallForConv.callId, activeCallForConv.callType || 'video', {
              email: user?.email || '',
              fullName: user?.fullName || user?.email || '',
              avatarUrl: user?.avatarUrl || ''
            })}
            className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 flex items-center gap-2"
          >
            Tham gia
          </button>
        </div>
      )}

      {/* Modern Multi-Pin Header */}
      <PinnedHeader />

      {/* Search Results Dropdown - Moved outside header and pinned to top-16 */}
      {isSearchBarOpen && (
        <div className="absolute top-16 left-6 right-6 max-w-xl mx-auto bg-white dark:bg-surface-container shadow-2xl rounded-b-2xl border border-outline-variant/20 overflow-hidden animate-in slide-in-from-top-2 duration-300 z-[100]">
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {localSearchQuery.trim().length < 2 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                  <Search size={24} className="text-primary/40" />
                </div>
                <p className="text-[13px] text-on-surface-variant font-medium">
                  {t('header.search_min_chars')}
                </p>
              </div>
            ) : isLocalSearching ? (
              <div className="p-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-primary" size={24} />
                <p className="text-[13px] text-on-surface-variant font-medium">{t('header.searching')}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[13px] text-on-surface-variant font-medium">
                  {t('header.no_messages_found', { query: localSearchQuery })}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="px-3 py-1.5 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
                  {t('header.search_results', { count: searchResults.length })}
                </p>
                {searchResults.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      jumpToMessage(msg.id);
                      handleCloseSearch();
                    }}
                    className="w-full flex flex-col gap-1 p-3 rounded-xl hover:bg-surface-container-highest text-left transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors">
                        {getDisplayName(msg.senderId, user, userProfiles)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/70 font-medium">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString(t('nav.back') === 'Back' ? 'en-US' : 'vi-VN') : ""}
                      </span>
                    </div>
                    <p className="text-[13px] text-on-surface-variant line-clamp-2 leading-snug">
                      {msg.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
