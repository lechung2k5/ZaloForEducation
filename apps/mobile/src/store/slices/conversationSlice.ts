import { StateCreator } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  chatGet,
  apiPost,
  chatPatch,
  apiDelete,
  apiPatch,
} from "../../utils/api";
import { normalizeConversation } from "../chatHelpers";
import { getMessagePreview } from "../../utils/chatUtils";
import { ChatStore } from "../chatStore";

const normalizeMentionEmail = (value?: string | null) =>
  String(value || '').replace(/^USER#/i, '').trim().toLowerCase();

const getMessageMentions = (message: any) => {
  const mentions = message?.mentions || message?.payload?.mentions || [];
  return Array.isArray(mentions) ? mentions : [];
};

const isMentionedInMessage = (message: any, currentUserEmail?: string | null) => {
  const normalizedCurrentUserEmail = normalizeMentionEmail(currentUserEmail);
  if (!normalizedCurrentUserEmail) return false;
  return getMessageMentions(message).some((mention: any) =>
    normalizeMentionEmail(typeof mention === 'string' ? mention : mention?.email) === normalizedCurrentUserEmail,
  );
};

export interface ConversationSlice {
  conversations: any[];
  activeConvId: string | null;
  setConversations: (input: any) => void;
  markReadLocal: (convId: string) => void;
  fetchConversations: () => Promise<any[]>;
  upsertConversationLastMessage: (
    convId: string,
    content: string,
    senderId?: string,
    isSystem?: boolean,
    messageId?: string,
  ) => void;
  mutedConversations: Record<string, any>;
  isConversationMuted: (convId: string) => boolean;
  setConversationMuted: (convId: string, muted: boolean) => Promise<void>;
  muteConversationFor: (
    convId: string,
    duration: "1h" | "4h" | "12h" | "until-8am" | "until-open" | boolean,
  ) => Promise<void>;
  clearConversationMuted: (convId: string) => Promise<void>;
  startDirectChat: (targetEmail: string) => Promise<string>;
  addMembers: (convId: string, memberEmails: string[]) => Promise<void>;
  removeMember: (convId: string, memberEmail: string) => Promise<void>;
  updateMemberRole: (
    convId: string,
    memberEmail: string,
    role: "owner" | "deputy" | "member",
  ) => Promise<void>;
  updateGroupInfo: (
    convId: string,
    updates: { name?: string; avatar?: string },
  ) => Promise<void>;
  dissolveGroup: (convId: string) => Promise<void>;
  setPinConversation: (convId: string, isPinned: boolean) => Promise<boolean>;
  setHiddenConversation: (convId: string, isHidden: boolean) => Promise<boolean>;
  updateConversationById: (convId: string, updates: any | ((prev: any) => any)) => void;

  // Inbox Parity
  tags: Array<{ id: string; name: string; color?: string }>;
  hiddenConversations: Record<string, string>;
  loadLocalData: () => Promise<void>;
  createTag: (tag: { id: string; name: string; color?: string }) => void;
  updateTag: (tag: { id: string; name: string; color?: string }) => void;
  deleteTag: (tagId: string) => void;
  assignTagToConversation: (convId: string, tagId: string | null) => void;
  hideConversationWithPin: (convId: string, pin: string) => void;
  unhideConversationWithPin: (convId: string, pin: string) => boolean;
}

export const createConversationSlice: StateCreator<
  ChatStore,
  [],
  [],
  ConversationSlice
> = (set, get) => ({
  conversations: [],
  activeConvId: null,
  mutedConversations: {},
  tags: [],
  hiddenConversations: {},

  loadLocalData: async () => {
    try {
      const tagsJson = await AsyncStorage.getItem("chat_tags");
      const hiddenJson = await AsyncStorage.getItem("chat_hidden");
      
      const tags = tagsJson ? JSON.parse(tagsJson) : [];
      const hiddenConversations = hiddenJson ? JSON.parse(hiddenJson) : {};
      
      set({ tags, hiddenConversations } as any);
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  },

  createTag: async (tag) => {
    const tags = [...get().tags, tag];
    await AsyncStorage.setItem("chat_tags", JSON.stringify(tags));
    set({ tags } as any);
  },

  updateTag: async (tag) => {
    const tags = get().tags.map((t: any) => (t.id === tag.id ? tag : t));
    await AsyncStorage.setItem("chat_tags", JSON.stringify(tags));
    set({ tags } as any);
  },

  deleteTag: async (tagId) => {
    const tags = get().tags.filter((t: any) => t.id !== tagId);
    await AsyncStorage.setItem("chat_tags", JSON.stringify(tags));
    
    // Also remove tag from conversations
    const convTagMapJson = await AsyncStorage.getItem("chat_conversation_tags");
    const convTagMap = convTagMapJson ? JSON.parse(convTagMapJson) : {};
    const nextMap = { ...convTagMap };
    
    Object.keys(nextMap).forEach((convId) => {
      if (nextMap[convId] === tagId) {
        delete nextMap[convId];
      }
    });
    
    await AsyncStorage.setItem("chat_conversation_tags", JSON.stringify(nextMap));
    
    set({
      tags,
      conversations: get().conversations.map((c) =>
        (c as any).tagId === tagId ? { ...c, tagId: undefined } : c
      ),
    } as any);
  },

  assignTagToConversation: async (convId, tagId) => {
    const convTagMapJson = await AsyncStorage.getItem("chat_conversation_tags");
    const map = convTagMapJson ? JSON.parse(convTagMapJson) : {};
    
    if (tagId) map[convId] = tagId;
    else delete map[convId];
    
    await AsyncStorage.setItem("chat_conversation_tags", JSON.stringify(map));
    
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, tagId } : c
      ),
    }) as any);
  },

  hideConversationWithPin: async (convId, pin) => {
    set((state) => {
      const nextHidden = { ...state.hiddenConversations, [convId]: pin };
      AsyncStorage.setItem("chat_hidden", JSON.stringify(nextHidden));
      return { hiddenConversations: nextHidden } as any;
    });
  },

  unhideConversationWithPin: (convId, pin) => {
    const currentPin = get().hiddenConversations[convId];
    if (currentPin === pin) {
      set((state) => {
        const nextHidden = { ...state.hiddenConversations };
        delete nextHidden[convId];
        AsyncStorage.setItem("chat_hidden", JSON.stringify(nextHidden));
        return { hiddenConversations: nextHidden } as any;
      });
      return true;
    }
    return false;
  },

  addMembers: async (convId, memberEmails) => {
    await apiPost(`/chat/conversations/${encodeURIComponent(convId)}/members`, {
      members: memberEmails,
    });
    await get().fetchConversations();
  },

  removeMember: async (convId, memberEmail) => {
    await apiDelete(
      `/chat/conversations/${encodeURIComponent(convId)}/members/${encodeURIComponent(memberEmail)}`,
    );
    const normalizedMemberEmail = String(memberEmail || "")
      .trim()
      .toLowerCase();
    const normalizedCurrentUserEmail = String(get().currentUserEmail || "")
      .trim()
      .toLowerCase();

    if (normalizedMemberEmail === normalizedCurrentUserEmail) {
      set(
        (state) =>
          ({
            conversations: state.conversations.filter((c) => c.id !== convId),
            activeConvId:
              state.activeConvId === convId ? null : state.activeConvId,
          }) as any,
      );
    } else {
      await get().fetchConversations();
    }
  },

  updateMemberRole: async (convId, memberEmail, role) => {
    await apiPatch(`/chat/conversations/${encodeURIComponent(convId)}/roles`, {
      targetEmail: memberEmail,
      role,
    });
    await get().fetchConversations();
  },

  updateGroupInfo: async (convId, updates) => {
    await chatPatch(`/conversations/${encodeURIComponent(convId)}`, updates);
    await get().fetchConversations();
  },

  dissolveGroup: async (convId) => {
    await apiDelete(`/chat/conversations/${encodeURIComponent(convId)}`);
    set(
      (state) =>
        ({
          conversations: state.conversations.filter((c) => c.id !== convId),
          activeConvId:
            state.activeConvId === convId ? null : state.activeConvId,
        }) as any,
    );
  },

  startDirectChat: async (targetEmail: string) => {
    const normalizedTarget = targetEmail.trim().toLowerCase();
    const myEmail = get().currentUserEmail?.toLowerCase();

    // Find existing
    const existing = get().conversations.find(
      (c) =>
        c.type === "direct" &&
        Array.isArray(c.members) &&
        c.members
          .map((m: string) => m.toLowerCase())
          .includes(normalizedTarget),
    );

    if (existing) return existing.id;

    // Create new via backend if needed, but for now we can just use the direct chat ID pattern
    // The backend usually creates it when first message is sent or explicitly.
    // Let's call the same API as Web.
    try {
      const res = await apiPost("/chat/conversations/direct", {
        targetEmail: normalizedTarget,
      });
      if (res.data?.id) {
        // Refresh conversations to get the new one
        await get().fetchConversations();
        return res.data.id;
      }
      throw new Error("Failed to create direct chat");
    } catch (err) {
      console.error("startDirectChat error", err);
      // Fallback: generate a probable ID if backend is simple
      const participants = [myEmail, normalizedTarget].sort();
      return `direct:${participants.join(":")}`;
    }
  },

  isConversationMuted: (convId: string) => {
    const norm = (id: string) => String(id || "").toLowerCase().replace(/^conv#/, "");
    const conversation = get().conversations.find((c) => norm(c.id) === norm(convId));
    if (conversation?.isMuted) return true;

    const muted = Object.entries(get().mutedConversations).find(
      ([key]) => norm(key) === norm(convId),
    )?.[1];
    if (!muted) return false;
    if (muted === true || muted === "until-open") return true;
    if (typeof muted === "number") return Date.now() < muted;
    return false;
  },

  setConversationMuted: async (convId, muted) => {
    if (!convId) return;
    const previousConversations = get().conversations;
    const previousMutedConversations = get().mutedConversations;
    const norm = (id: string) => String(id || "").toLowerCase().replace(/^conv#/, "");

    set((state) => {
      const nextMutedConversations = { ...state.mutedConversations };
      Object.keys(nextMutedConversations).forEach((key) => {
        if (norm(key) === norm(convId)) delete nextMutedConversations[key];
      });
      if (muted) nextMutedConversations[convId] = true;

      return {
        conversations: state.conversations.map((c) =>
          norm(c.id) === norm(convId) ? { ...c, isMuted: muted } : c,
        ),
        mutedConversations: nextMutedConversations,
      } as any;
    });

    try {
      const res = await chatPatch(`/conversations/${encodeURIComponent(convId)}/settings`, { isMuted: muted });
      if (res && res.ok === false) throw new Error(res.message || "SYNC_FAILED");
    } catch (err) {
      console.error("Failed to set conversation muted", err);
      set({
        conversations: previousConversations,
        mutedConversations: previousMutedConversations,
      } as any);
      throw err;
    }
  },

  muteConversationFor: async (convId, duration) => {
    let until: any = true;
    if (duration === "1h") until = Date.now() + 60 * 60 * 1000;
    else if (duration === "4h") until = Date.now() + 4 * 60 * 60 * 1000;
    else if (duration === "12h") until = Date.now() + 12 * 60 * 60 * 1000;
    else if (duration === "until-8am") {
      const d = new Date();
      if (d.getHours() >= 8) d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      until = d.getTime();
    } else if (duration === "until-open") until = "until-open";

    const previousConversations = get().conversations;
    const previousMutedConversations = get().mutedConversations;

    set(
      (state) =>
        ({
          conversations: state.conversations.map((c) =>
            String(c.id || "").toLowerCase().replace(/^conv#/, "") === String(convId || "").toLowerCase().replace(/^conv#/, "")
              ? { ...c, isMuted: true }
              : c,
          ),
          mutedConversations: { ...state.mutedConversations, [convId]: until },
        }) as any,
    );

    try {
      const res = await chatPatch(`/conversations/${encodeURIComponent(convId)}/settings`, { isMuted: true });
      if (res && res.ok === false) throw new Error(res.message || "SYNC_FAILED");
    } catch (err) {
      console.error("Failed to mute conversation", err);
      set({
        conversations: previousConversations,
        mutedConversations: previousMutedConversations,
      } as any);
      throw err;
    }
  },

  clearConversationMuted: async (convId) => {
    await get().setConversationMuted(convId, false);
  },

  setConversations: (input) => {
    const current = Array.isArray(get().conversations)
      ? get().conversations
      : [];
    const resolved = typeof input === "function" ? input(current) : input;
    set({ conversations: Array.isArray(resolved) ? resolved : current } as any);
  },

  markReadLocal: (convId) =>
    set((state) => {
      const convIndex = state.conversations.findIndex((c) => c.id === convId);
      if (convIndex === -1) return state;

      const nextConversations = [...state.conversations];
      nextConversations[convIndex] = {
        ...nextConversations[convIndex],
        unreadCount: 0,
        hasUnreadMention: false,
        mentionCount: 0,
        lastMentionMessageId: undefined,
        lastMentionAt: undefined,
      };

      return { conversations: nextConversations } as any;
    }),

  fetchConversations: async () => {
    try {
      const res = await chatGet("/conversations");
      let data = [];
      if (Array.isArray(res?.data)) {
        data = res.data;
      } else if (res && typeof res === "object") {
        const numericKeys = Object.keys(res)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b));
        if (numericKeys.length > 0) {
          data = numericKeys.map((k) => res[k]);
        }
      }

      const currentConversations = get().conversations;
      const currentUserEmail = get().currentUserEmail;

      const reconciled = data
        .map((rawConv) => {
          const newConv = normalizeConversation(rawConv, currentUserEmail);
          if (!newConv) return null;

          // Format last message preview for system messages and others
          try {
            const lm = rawConv.lastMessageContent || rawConv.lastMessage || "";
            const userProfiles = get().userProfiles || {};
            const preview =
              require("../../utils/chatUtils").formatSystemPreview(
                lm,
                rawConv.lastMessageSenderId ||
                  rawConv.lastMessageSender ||
                  rawConv.senderId,
                userProfiles,
                currentUserEmail,
              );
            (newConv as any).lastMessageContent = preview;
          } catch (e) {}

          const existing = currentConversations.find((c) => c.id === newConv.id);
          if (existing) {
            // [SENIOR] Protect against stale GET /conversations overwriting local optimistic state
            const existingTime = new Date(existing.updatedAt || 0).getTime();
            const newTime = new Date(newConv.updatedAt || 0).getTime();
            
            if (existingTime > newTime) {
              return { 
                ...newConv, 
                unreadCount: existing.unreadCount,
                lastMessage: existing.lastMessage,
                lastMessageContent: existing.lastMessageContent,
                updatedAt: existing.updatedAt,
              };
            }

            if (existing.unreadCount === 0 && newConv.unreadCount > 0) {
              if (
                String(existing.lastMessage) === String(newConv.lastMessage)
              ) {
                return { ...newConv, unreadCount: 0 };
              }
            }
          }
          return newConv;
          })
          .filter((c) => c !== null);

      // Merge tags from AsyncStorage
      const convTagMapJson = await AsyncStorage.getItem("chat_conversation_tags");
      const convTagMap = convTagMapJson ? JSON.parse(convTagMapJson) : {};

      const reconciledWithTags = reconciled.map((c: any) => ({
        ...c,
        tagId: convTagMap[c.id] || c.tagId || undefined,
      }));

      set({ conversations: reconciledWithTags } as any);
      return reconciledWithTags;
    } catch (err) {
      console.error("Failed to fetch conversations", err);
      return [];
    }
  },

  upsertConversationLastMessage: (
    convId: string,
    messageData: any, // [SENIOR] Pass the whole message to ensure type/media/files are updated
  ) => {
    const { content, senderId, type, media, files, id: messageId } = messageData;
    const isSystem = type === 'system';

    set((state) => {
      const convIndex = state.conversations.findIndex((c) => c.id === convId);
      
      // [SENIOR] If conversation not found in current list, we should probably refetch
      if (convIndex === -1) {
        // We can't call async fetch here directly in set(), 
        // so we'll trigger a side effect or just let the next refresh handle it.
        // For now, let's at least try to fetch if we have the method.
        setTimeout(() => get().fetchConversations(), 500);
        return state;
      }

      const nextConversations = [...state.conversations];
      const target = { ...nextConversations[convIndex] };
      
      // Update metadata
      target.lastMessage = messageId || target.lastMessage;
      target.lastMessageType = type || target.lastMessageType;
      target.lastMessageMedia = media || target.lastMessageMedia;
      target.lastMessageFiles = files || target.lastMessageFiles;
      target.updatedAt = messageData?.createdAt || new Date().toISOString();

      const isActive = state.activeConvId === convId;
      const isOwn = String(senderId || '').replace(/^USER#/, "").trim().toLowerCase() === String(get().currentUserEmail || '').trim().toLowerCase();
      const isMentioned = !isOwn && isMentionedInMessage(messageData, get().currentUserEmail);

      if (!isActive && !isOwn) {
        target.unreadCount = (target.unreadCount || 0) + 1;
      }

      if (isOwn) {
        target.unreadCount = 0;
        target.hasUnreadMention = false;
        target.mentionCount = 0;
      }

      if (isMentioned && !isActive) {
        target.hasUnreadMention = true;
        target.mentionCount = (target.mentionCount || 0) + 1;
        target.lastMentionMessageId = messageId || messageData?.messageId || target.lastMessage;
        target.lastMentionAt = new Date().toISOString();
      }

      // Try to create a human-readable preview for system messages (Vietnamese)
      let preview = content;
      if (isSystem && typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          if (parsed && parsed.action) {
            const userProfiles = (get() as any).userProfiles || {};
            const currentUserEmail = (get() as any).currentUserEmail || "";

            const nameOf = (email: string | undefined) => {
              if (!email) return "";
              const normalized = String(email || "")
                .trim()
                .toLowerCase();
              if (
                normalized ===
                String(currentUserEmail || "")
                  .trim()
                  .toLowerCase()
              )
                return "Bạn";
              const p = userProfiles[normalized];
              if (p)
                return p.nickname || p.fullName || p.fullname || normalized;
              // fallback to local part
              return String(email).split("@")[0];
            };

            const actor = parsed.actor || senderId;
            const actorName = nameOf(actor);

            switch (parsed.action) {
              case "group_created":
                preview = actorName + " đã tạo nhóm";
                break;
              case "member_added": {
                const added =
                  parsed.members ||
                  (parsed.member ? [parsed.member] : parsed.added || []);
                const names = Array.isArray(added)
                  ? added.map((e: string) => nameOf(e)).filter(Boolean)
                  : [];
                preview =
                  names.length > 0
                    ? `${actorName} đã thêm ${names.join(", ")}`
                    : `${actorName} đã thêm thành viên`;
                break;
              }
              case "member_removed": {
                const removed = parsed.member || parsed.target;
                const name = nameOf(removed);
                preview = name
                  ? `${actorName} đã xóa ${name}`
                  : `${actorName} đã xóa thành viên`;
                break;
              }
              case "member_left": {
                const who = parsed.member || parsed.actor || senderId;
                const name = nameOf(who);
                preview = name ? `${name} đã rời nhóm` : "Đã rời nhóm";
                break;
              }
              case "transferred_owner":
              case "role_updated": {
                const targetEmail = parsed.target || parsed.to || parsed.member;
                const targetName = nameOf(targetEmail);
                const role =
                  parsed.role || parsed.toRole || parsed.newRole || "";
                if (parsed.action === "transferred_owner") {
                  preview = `${actorName} đã chuyển quyền trưởng nhóm cho ${targetName || "một thành viên"}`;
                } else if (role) {
                  const roleLabel =
                    role === "owner"
                      ? "Trưởng nhóm"
                      : role === "deputy"
                        ? "Phó nhóm"
                        : "thành viên";
                  preview = `${actorName} đã đặt ${targetName || "một thành viên"} làm ${roleLabel}`;
                } else {
                  preview = "[Cập nhật vai trò]";
                }
                break;
              }
              case "info_updated":
                preview = actorName + " đã cập nhật thông tin nhóm";
                break;
              default:
                // fallback to generic preview generator
                preview = getMessagePreview({ type: "system", content });
                break;
            }
          } else {
            preview = getMessagePreview({ type: "system", content });
          }
        } catch (e) {
          preview = getMessagePreview({ type: "system", content });
        }
      } else {
        preview = getMessagePreview({ content });
      }

      target.lastMessageContent = isMentioned && !isActive ? `@ Bạn · ${preview}` : preview;
      if (senderId) {
        target.lastMessageSenderId = senderId;
      }
      target.updatedAt = new Date().toISOString();

      nextConversations.splice(convIndex, 1);
      nextConversations.unshift(target);

      return { conversations: nextConversations } as any;
    });
  },

  setPinConversation: async (convId: string, isPinned: boolean) => {
    try {
      // Try to sync with backend
      const res = await chatPatch(`/conversations/${encodeURIComponent(convId)}/settings`, { isPinned });
      if (!res?.ok) throw new Error('SYNC_FAILED');
      
      // Update local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId ? { ...c, pinned: isPinned } : c
        )
      } as any));
      
      return true;
    } catch (err) {
      console.error('Failed to sync pin state', err);
      // Fallback: just update local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId ? { ...c, pinned: isPinned } : c
        )
      } as any));
      return false;
    }
  },

  setHiddenConversation: async (convId: string, isHidden: boolean) => {
    // Update local state (client-only feature)
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, hidden: isHidden } : c
      )
    } as any));
    return true;
  },

  updateConversationById: (convId, updater) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId
          ? typeof updater === "function"
            ? (updater as any)(c)
            : { ...c, ...updater }
          : c,
      ),
    })),
});
