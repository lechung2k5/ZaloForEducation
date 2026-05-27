import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../../store/chatStore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  getDisplayName,
  getDisplayAvatar,
  isUnread,
  getConversationPreviewText,
  DEFAULT_GROUP_AVATAR,
} from "../../utils/chatUtils";
import CreateGroupModal from "./CreateGroupModal";
import { BOT_EMAIL } from "@zalo-edu/shared";
import ConversationTagPicker from "./ConversationTagPicker";
import Swal from "sweetalert2";
import { useSecurityAlerts } from "../../hooks/useSecurityAlerts";

import { Lock, MoreHorizontal, UserPlus, Users, BellOff, Pin } from "lucide-react";

const InboxList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTheme();
  const {
    conversations,
    activeConvId,
    fetchConversations,
    searchQuery,
    setSearchQuery,
    setIsSearching,
    setActiveConversation,
    loadUserProfile,
    userProfiles,
    hiddenConversations,
    hideConversationWithPin,
    unhideConversationWithPin,
    isCreateGroupModalOpen,
    setIsCreateGroupModalOpen,
    tags,
    pinConversation,
  } = useChatStore();

  const [chatFilter, setChatFilter] = useState<"all" | "unread">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [convMenu, setConvMenu] = useState<null | {
    convId: string;
    x: number;
    y: number;
  }>(null);
  const [tagPickerPos, setTagPickerPos] = useState<null | {
    convId: string;
    x: number;
    y: number;
  }>(null);

  const { alerts, unreadCount: systemUnreadCount } = useSecurityAlerts();

  // Fetch conversations on mount
  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Sync friendship updates
  React.useEffect(() => {
    const handleFriendshipUpdated = () => {
      fetchConversations();
    };

    window.addEventListener("friendship-updated", handleFriendshipUpdated);
    return () => {
      window.removeEventListener("friendship-updated", handleFriendshipUpdated);
    };
  }, [fetchConversations]);

  // Auto-load profiles for partners in conversations
  React.useEffect(() => {
    if (conversations.length > 0) {
      conversations.forEach((conv) => {
        if (conv.type === "direct") {
          const partnerEmail = Array.isArray(conv.members)
            ? conv.members.find((m) => {
                const normalizedM = String(m || "")
                  .trim()
                  .toLowerCase();
                const normalizedMe = String(user?.email || "")
                  .trim()
                  .toLowerCase();
                return normalizedM !== normalizedMe;
              })
            : undefined;

          if (partnerEmail) {
            loadUserProfile(partnerEmail);
          }
        }
      });
    }
  }, [conversations, user?.email, loadUserProfile]);

  const handleSearchTrigger = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsSearching(false);
  };
  const normalizedSearch = String(searchQuery || "")
    .trim()
    .toLowerCase();

  const conversationMatchesSearch = (conv: any) => {
    if (!normalizedSearch) return true;

    const partnerEmail =
      conv.type === "direct"
        ? Array.isArray(conv.members)
          ? conv.members.find((m: string) => m !== user?.email)
          : ""
        : "";

    const name =
      conv.type === "direct"
        ? getDisplayName(partnerEmail, user, userProfiles)
        : conv.name || "";

    const haystack = [
      String(name || ""),
      String(partnerEmail || ""),
      String(conv.lastMessageContent || ""),
      String(conv.lastMessage || ""),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  };

  const handleHideConversation = async (convId: string) => {
    const res = await Swal.fire({
      title: t('inbox.hide_title'),
      text: t('inbox.hide_text'),
      input: "password",
      inputPlaceholder: t('inbox.pin_placeholder'),
      inputAttributes: {
        maxlength: "6",
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: t('inbox.hide_btn'),
      cancelButtonText: t('inbox.cancel'),
      confirmButtonColor: "#00418f",
      inputValidator: (value) => {
        if (!/^\d{4,6}$/.test(String(value || ""))) {
          return t('inbox.pin_invalid');
        }
        return undefined;
      },
    });

    if (!res.isConfirmed || !res.value) return;
    hideConversationWithPin(convId, String(res.value));
    setConvMenu(null);
    Swal.fire({
      icon: "success",
      title: t('inbox.hide_success'),
      timer: 1300,
      showConfirmButton: false,
    });
  };

  const handleUnhideConversation = async (convId: string) => {
    const res = await Swal.fire({
      title: t('inbox.unlock_title'),
      text: t('inbox.unlock_text'),
      input: "password",
      inputPlaceholder: t('inbox.pin_placeholder'),
      showCancelButton: true,
      confirmButtonText: t('inbox.unlock_btn'),
      cancelButtonText: t('inbox.cancel'),
      confirmButtonColor: "#00418f",
    });
    if (!res.isConfirmed || !res.value) return;

    const ok = unhideConversationWithPin(convId, String(res.value));
    if (!ok) {
      Swal.fire(t('inbox.pin_wrong'), t('inbox.pin_wrong'), "error");
      return;
    }
    setConvMenu(null);
    Swal.fire({
      icon: "success",
      title: t('inbox.unlock_success'),
      timer: 1300,
      showConfirmButton: false,
    });
  };

  const filteredConversations = conversations.filter((conv: any) => {
    // 0. Exclude Bot conversations - AI Assistant should only be in its own tab
    const hasBot = Array.isArray(conv.members) && conv.members.some(m => {
      const normalized = String(m || "").toLowerCase();
      return normalized === String(BOT_EMAIL).toLowerCase() || normalized.includes('bot@unichat.system');
    });
    if (hasBot) return false;

    // 1. Unread filter
    if (chatFilter === "unread" && !isUnread(conv, user?.email)) return false;

    // 2. Tag filter
    if (tagFilter) {
      if (tagFilter === "none" && conv.tagId) return false;
      if (tagFilter !== "none" && conv.tagId !== tagFilter) return false;
    }

    // 3. Hidden conversations logic
    const isHidden = !!hiddenConversations[conv.id];
    if (isHidden) {
      // Only show hidden conversations if they match the search query (and search is active)
      return normalizedSearch.length > 0 && conversationMatchesSearch(conv);
    }

    // 4. Search filter
    return conversationMatchesSearch(conv);
  });

  if (alerts.length > 0) {
    const systemConv = {
      id: "CONV#SYSTEM",
      name: "Cảnh báo bảo mật",
      type: "system",
      avatar:
        "https://ui-avatars.com/api/?name=Alert&background=ff3b30&color=fff&bold=true",
      lastMessageContent: alerts[0].title,
      updatedAt: alerts[0].at,
      unreadCount: systemUnreadCount,
    };

    const matchesSearch = normalizedSearch
      ? "cảnh báo bảo mật alert".includes(normalizedSearch) ||
        (alerts[0].title || "").toLowerCase().includes(normalizedSearch)
      : true;
    const matchesUnread =
      chatFilter === "unread" ? systemUnreadCount > 0 : true;

    if (matchesSearch && matchesUnread) {
      filteredConversations.unshift(systemConv as any);
    }
  }

  const sortedFilteredConversations = React.useMemo(() => {
    const systemConvs = filteredConversations.filter((c: any) => c.id === "CONV#SYSTEM");
    const normalConvs = filteredConversations.filter((c: any) => c.id !== "CONV#SYSTEM");

    const pinnedConvs = normalConvs
      .filter((c: any) => c.isPinned)
      .sort((a: any, b: any) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

    const unpinnedConvs = normalConvs
      .filter((c: any) => !c.isPinned)
      .sort((a: any, b: any) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

    return [...systemConvs, ...pinnedConvs, ...unpinnedConvs];
  }, [filteredConversations]);

  return (
    <div className="w-85 h-full border-r border-outline-variant/30 flex flex-col bg-white dark:bg-surface-container shrink-0">
      {/* Search Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              value={searchQuery}
              onChange={handleSearchTrigger}
              onFocus={() => setIsSearching(true)}
              className="w-full bg-surface-container-highest border-none rounded-2xl py-2 pl-9 pr-4 text-[13px] outline-none text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 transition-all cursor-text"
              placeholder={t('inbox.search_placeholder')}
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                useChatStore.getState().setIsAddFriendModalOpen(true)
              }
              className="w-10 h-10 flex items-center justify-center hover:bg-white/60 dark:hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant hover:text-primary active:scale-95"
            >
              <UserPlus size={20} />
            </button>
            <button
              onClick={() => navigate("/group")}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/60 dark:hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant hover:text-primary active:scale-95"
            >
              <Users size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-bold px-1 relative">
          <button
            onClick={() => setChatFilter("all")}
            className={`${chatFilter === "all" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"} transition-all pb-2`}
          >
            {t('inbox.all')}
          </button>
          <button
            onClick={() => setChatFilter("unread")}
            className={`${chatFilter === "unread" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"} transition-all pb-2`}
          >
            {t('inbox.unread')}
          </button>

          <button
            onClick={() => setClassifyOpen((prev) => !prev)}
            className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-[13px] text-on-surface-variant hover:bg-surface-container"
          >
            {t('inbox.classify')}
            <span className="material-symbols-outlined text-[18px]">
              expand_more
            </span>
          </button>

          {classifyOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-xl">
              <div className="border-b px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">
                {t('inbox.by_status')}
              </div>
              <button
                onClick={() => {
                  setChatFilter("all");
                  setClassifyOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-container ${chatFilter === "all" ? "text-primary" : "text-on-surface"}`}
              >
                <span>{t('inbox.all')}</span>
                {chatFilter === "all" && (
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setChatFilter("unread");
                  setClassifyOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-container ${chatFilter === "unread" ? "text-primary" : "text-on-surface"}`}
              >
                <span>{t('inbox.unread')}</span>
                {chatFilter === "unread" && (
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                )}
              </button>

              <div className="border-t border-outline-variant/10" />
              <div className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">
                {t('inbox.by_tag')}
              </div>
              <button
                onClick={() => {
                  setTagFilter(null);
                  setClassifyOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-container ${tagFilter === null ? "text-primary" : "text-on-surface"}`}
              >
                <span>{t('inbox.all')}</span>
                {tagFilter === null && (
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setTagFilter("none");
                  setClassifyOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-container ${tagFilter === "none" ? "text-primary" : "text-on-surface"}`}
              >
                <span>{t('inbox.no_tag')}</span>
                {tagFilter === "none" && (
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                )}
              </button>
              {tags.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTagFilter(t.id);
                    setClassifyOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-surface-container ${tagFilter === t.id ? "text-primary" : "text-on-surface"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{ background: t.color || "#ffb020" }}
                      className="inline-block h-3 w-3 rounded-sm"
                    />
                    <span>{t.name}</span>
                  </div>
                  {tagFilter === t.id && (
                    <span className="material-symbols-outlined text-[18px]">
                      check
                    </span>
                  )}
                </button>
              ))}

              <div className="border-t border-outline-variant/10 px-3 py-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-chat-tag-manager"),
                    );
                    setClassifyOpen(false);
                  }}
                  className="text-[13px] text-on-surface-variant"
                >
                  {t('inbox.manage_tags')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar p-2 space-y-1">
        {sortedFilteredConversations.length === 0 ? (
          <div className="text-center p-8 opacity-40 mt-10">
            <span className="material-symbols-outlined text-[48px] mb-2 text-on-surface-variant/20">
              chat_bubble
            </span>
            <p className="text-[13px] font-medium">
              {t('inbox.empty')}
            </p>
          </div>
        ) : (
          sortedFilteredConversations.map((chat) => {
            const isSelected = activeConvId === chat.id;
            const conversationTag = (tags || []).find(
              (t: any) => t.id === (chat as any).tagId,
            );
            const partnerEmail =
              chat.type === "direct"
                ? Array.isArray(chat.members)
                  ? chat.members.find((m) => {
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

            const chatName =
              chat.type === "direct"
                ? getDisplayName(partnerEmail, user, userProfiles)
                : chat.name || "Group";

            const chatAvatar =
              chat.type === "direct"
                ? getDisplayAvatar(partnerEmail, user, userProfiles)
                : chat.avatar || DEFAULT_GROUP_AVATAR;

            const unread = isUnread(chat, user?.email);
            const normalizedPartner = partnerEmail
              ? String(partnerEmail).trim().toLowerCase()
              : "";
            const isOnline = normalizedPartner
              ? userProfiles[normalizedPartner]?.status === "online"
              : false;
            const isHidden = !!hiddenConversations[chat.id];

            const previewText = (() => {
              if (isHidden) {
                return t('inbox.hidden_chat');
              }
              if ((chat as any).type === "system") {
                return chat.lastMessageContent;
              }

              const preview = getConversationPreviewText(
                chat,
                user,
                userProfiles,
              );

              // Keep call previews using the more explicit call direction labels.
              if (
                preview === "[Cuộc gọi thoại]" ||
                preview === "[Cuộc gọi video]"
              ) {
                const isVideo = preview.includes("video");
                const isOutgoing = chat.lastMessageSenderId === user?.email;
                if (isVideo) {
                  return isOutgoing ? t('inbox.call_video_out') : t('inbox.call_video_in');
                } else {
                  return isOutgoing ? t('inbox.call_voice_out') : t('inbox.call_voice_in');
                }
              }

              return preview;
            })();

            const showMentionTag = !isHidden && chat.hasUnreadMention;

            return (
              <div
                key={chat.id}
                onClick={() => {
                  if (isHidden) {
                    Swal.fire({
                      icon: "info",
                      title: t('inbox.hidden_warning_title'),
                      text: t('inbox.hidden_warning_text'),
                      timer: 2000,
                      showConfirmButton: false,
                    });
                    return;
                  }
                  setActiveConversation(chat.id);
                }}
                className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? "bg-primary/10 shadow-sm"
                    : chat.isPinned
                      ? "bg-primary/[0.04] dark:bg-primary/[0.06] hover:bg-primary/[0.08] dark:hover:bg-primary/[0.1] border-l-4 border-primary/50 pl-2 rounded-l-none"
                      : "hover:bg-surface-container/70"
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    className="w-12 h-12 rounded-full object-cover shadow-sm bg-surface-container ring-1 ring-black/5"
                    alt={chatName}
                    src={chatAvatar}
                  />
                  {isOnline && (chat as any).type !== "system" && (
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-surface-container rounded-full shadow-sm ring-1 ring-black/5 animate-pulse"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3
                      className={`text-[14px] truncate ${unread ? "font-bold" : "font-semibold"} ${isSelected ? "text-primary" : "text-on-surface"}`}
                    >
                      {chatName}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {chat.isPinned && (
                        <Pin size={12} className="text-primary rotate-45 transform" />
                      )}
                      {chat.updatedAt && (
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {new Date(chat.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {conversationTag && (
                        <span
                          className="material-symbols-outlined shrink-0 text-[16px]"
                          style={{ color: conversationTag.color || "#ffb020" }}
                          title={t('inbox.tag', { name: conversationTag.name })}
                        >
                          folder
                        </span>
                      )}
                      <p
                        className={`text-[13px] truncate ${unread ? "font-bold text-on-surface" : "text-on-surface-variant"}`}
                      >
                        {showMentionTag && (
                          <span className="text-[12px] font-black text-rose-500 mr-1.5 animate-pulse shrink-0">
                            {t('inbox.mention_tag')}
                          </span>
                        )}
                        <span>{previewText}</span>
                      </p>
                    </div>
                    {chat.isMuted ? (
                      <div className="ml-2 flex items-center justify-center text-on-surface-variant/40">
                        <BellOff size={16} />
                      </div>
                    ) : (
                      <>
                        {unread && chat.unreadCount > 0 && (
                          <div className="min-w-5 h-5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ml-2 shadow-sm shadow-error/20">
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </div>
                        )}
                        {unread &&
                          (!chat.unreadCount || chat.unreadCount === 0) && (
                            <div className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 ml-2 shadow-sm shadow-primary/20"></div>
                          )}
                      </>
                    )}
                  </div>
                </div>

                {(chat as any).type !== "system" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setConvMenu({
                        convId: chat.id,
                        x: Math.min(rect.right - 220, window.innerWidth - 240),
                        y: Math.min(rect.bottom + 8, window.innerHeight - 180),
                      });
                    }}
                    className="rounded-full p-1 text-on-surface-variant opacity-0 transition group-hover:opacity-100 hover:bg-surface-container"
                    title={t('inbox.options')}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {convMenu && (
        <>
          <div
            className="fixed inset-0 z-100"
            onClick={() => setConvMenu(null)}
          />
          <div
            className="fixed z-110 w-56 overflow-hidden rounded-2xl border border-outline-variant/20 bg-white p-2 shadow-2xl"
            style={{ left: convMenu.x, top: convMenu.y }}
          >
            {(() => {
              const mUniChat = conversations.find(c => c.id === convMenu.convId);
              if (!mUniChat) return null;
              const isPinned = !!mUniChat.isPinned;
              return (
                <button
                  onClick={async () => {
                    setConvMenu(null);
                    try {
                      await pinConversation(mUniChat.id, !isPinned);
                      Swal.fire({
                        icon: "success",
                        title: !isPinned ? t('inbox.pin') : t('inbox.unpin'),
                        toast: true,
                        position: "top-end",
                        showConfirmButton: false,
                        timer: 1500,
                        timerProgressBar: true,
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-on-surface hover:bg-surface-container"
                >
                  <Pin size={14} className="rotate-45" />
                  {isPinned ? t('inbox.unpin') : t('inbox.pin')}
                </button>
              );
            })()}
            <button
              onClick={() => {
                setTagPickerPos({
                  convId: convMenu.convId,
                  x: convMenu.x + 180,
                  y: convMenu.y,
                });
                setConvMenu(null);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-on-surface hover:bg-surface-container"
            >
              {t('inbox.classify')}
            </button>
            <button
              onClick={() => {
                const isHidden = !!hiddenConversations[convMenu.convId];
                if (isHidden) {
                  handleUnhideConversation(convMenu.convId);
                } else {
                  handleHideConversation(convMenu.convId);
                }
              }}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-on-surface hover:bg-surface-container"
            >
              <Lock size={14} />
              {hiddenConversations[convMenu.convId]
                ? t('inbox.unlock')
                : t('inbox.lock')}
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-chat-tag-manager"));
                setConvMenu(null);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-on-surface hover:bg-surface-container"
            >
              {t('inbox.manage_tags')}
            </button>
          </div>
        </>
      )}

      {tagPickerPos && (
        <div
          style={{
            position: "fixed",
            left: Math.min(tagPickerPos.x, window.innerWidth - 280),
            top: Math.min(tagPickerPos.y, window.innerHeight - 360),
            zIndex: 120,
          }}
        >
          <ConversationTagPicker
            convId={tagPickerPos.convId}
            onClose={() => setTagPickerPos(null)}
          />
        </div>
      )}

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
      />
    </div>
  );
};

export default InboxList;
