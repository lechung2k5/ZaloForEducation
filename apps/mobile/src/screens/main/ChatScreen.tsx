import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Modal,
  Keyboard,
  Animated,
  RefreshControl,
  PermissionsAndroid
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from "../../store/callStore";
import { useGroupCallStore } from "../../store/groupCallStore";
import { useAuth } from '../../context/AuthContext';
import { ImageBackground } from "react-native";
import { chatGet, chatPost, chatPatch, apiPost, chatUpload } from '../../utils/api';
import SocketService from '../../utils/socket';
import MessageBubble from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import SystemCallMessageItem from '../../components/chat/SystemCallMessageItem';
import SystemNotificationItem from '../../components/chat/SystemNotificationItem';
import { ConversationList } from '../../components/home/ConversationList';
import { getStyles } from './style/ChatScreen.styles';
import { useTheme } from '../../context/ThemeContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { 
  pruneExpiredSchedules, 
  getMuteLabel, 
  createMuteUntilHours, 
  createMuteUntilMorning, 
  createCustomWindowMuteSchedule, 
  isValidTimeString
} from '../../utils/chatUtils';

// Components
import { ChatHeader } from "../../components/chat/ChatHeader";
import { PinBanner } from "../../components/chat/PinBanner";
import { ChatModals } from "../../components/chat/ChatModals";
import { ForwardModal } from "../../components/chat/ForwardModal";
import PollComposer from "../../components/chat/PollComposer";
import ReminderComposer from "../../components/chat/ReminderComposer";
import { dismissNotificationsByConversation } from "../../utils/reminderNotifications";
import {
  DEFAULT_CHAT_WALLPAPER_ID,
  getChatWallpaperSource,
  getConversationWallpaperId,
  type ChatWallpaperId,
} from "../../utils/chatWallpapers";

const CHAT_MUTE_SCHEDULE_KEY = "chat_notification_mute_schedule_v1";
const CHAT_PINNED_CONVERSATIONS_KEY = 'chat_pinned_conversations_v1';
const CHAT_HIDDEN_CONVERSATIONS_KEY = 'chat_hidden_conversations_v1';
const CHAT_ALIAS_CONVERSATIONS_KEY = 'chat_alias_conversations_v1';

interface ChatScreenProps {
  navigation?: any;
  onNavigate?: (screen: string, params?: any) => void;
  goBack?: () => void;
  params: {
    conversationId?: string;
    targetMessageId?: string;
    targetEmail?: string;
    startCall?: 'audio' | 'video';
  };
}

type MentionPayload = {
  email: string;
  displayName?: string;
  start?: number;
  end?: number;
};

export default function ChatScreen({ navigation, onNavigate, goBack, params }: ChatScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768; // Tablet/Web Responsive
  const { conversationId, targetEmail, startCall, targetMessageId: paramTargetMessageId } = params || {};

  useEffect(() => {
    console.log("[ChatScreen] Params received:", { conversationId, targetEmail, startCall });
  }, [conversationId, targetEmail, startCall]);

  // ZUSTAND STORE
  const {
    conversations,
    messages,
    setActiveConversation,
    startDirectChat,
    updateMessage,
    setConversations,
    sendMessageOptimistic,
    userProfiles,
    fetchMoreMessages,
    fetchNewerMessages,
    isLoadingMessages,
    nextCursor,
    prevCursor,
    fetchToken,
    targetMessageId, // from store
    patchMessageOptimistic,
    deleteMessageOptimistic,
    markNotificationsRead,
    currentUserEmail,
    fetchMessage,
    pinnedMessagesCache
  } = useChatStore();

  const { startOutgoingCall, resetCall, setMeetingInfo } = useCallStore();

  // LOCAL STATE
  const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId || null);
  const [localConversation, setLocalConversation] = useState<any>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isPinsExpanded, setIsPinsExpanded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [actionMessage, setActionMessage] = useState<any>(null);
  const [detailMessage, setDetailMessage] = useState<any>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [muteScheduleMap, setMuteScheduleMap] = useState<Record<string, any>>({});
  const [showMuteMenuModal, setShowMuteMenuModal] = useState(false);
  const [showCustomMuteModal, setShowCustomMuteModal] = useState(false);
  const [customMuteStartTime, setCustomMuteStartTime] = useState("22:00");
  const [customMuteEndTime, setCustomMuteEndTime] = useState("07:00");
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [wallpaperId, setWallpaperId] = useState<ChatWallpaperId>(DEFAULT_CHAT_WALLPAPER_ID);
  const [blockedFriendships, setBlockedFriendships] = useState<any[]>([]);

  useEffect(() => {
    if (conversationId) setCurrentConvId(conversationId);
  }, [conversationId]);

  const typingTimeoutRef = useRef<any>(null);
  const messagesScrollRef = useRef<FlatList>(null);
  const lastScrolledMessageId = useRef<string | null>(null);

  const normalizeEmail = useCallback((email: string | null | undefined) => String(email || "").trim().toLowerCase(), []);

  // LOGIC PHÂN NHÓM VÀ NGÀY THÁNG (MESSENGER STYLE)
  const processedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    
    // Deduplicate to prevent "Two children with the same key" error
    const seenIds = new Set();
    const uniqueMessages = messages.filter(m => {
      if (!m.id || seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });

    const results: any[] = [];
    const sorted = uniqueMessages; // Use deduplicated messages

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = i > 0 ? sorted[i - 1] : null; 
      const prev = i < sorted.length - 1 ? sorted[i + 1] : null;

      // [SENIOR] Pre-calculate timestamps and date strings once
      const currentObj = current.createdAt ? new Date(current.createdAt) : null;
      const currentTs = currentObj ? currentObj.getTime() : 0;
      const currDateStr = currentObj ? currentObj.toDateString() : '';

      const prevObj = prev && prev.createdAt ? new Date(prev.createdAt) : null;
      const prevTs = prevObj ? prevObj.getTime() : 0;
      const prevDateStr = prevObj ? prevObj.toDateString() : '';

      const nextTs = next && next.createdAt ? new Date(next.createdAt).getTime() : 0;

      // Kiểm tra Grouping
      const isMe = normalizeEmail(current.senderId) === normalizeEmail(currentUserEmail);
      const prevIsMe = prev && normalizeEmail(prev.senderId) === normalizeEmail(current.senderId);
      const nextIsMe = next && normalizeEmail(next.senderId) === normalizeEmail(current.senderId);

      const diffPrev = prevTs ? Math.abs(currentTs - prevTs) : Infinity;
      const diffNext = nextTs ? Math.abs(currentTs - nextTs) : Infinity;

      const gapLimit = 5 * 60 * 1000; // 5 phút

      let groupPosition: 'first' | 'middle' | 'last' | 'single' = 'single';
      if (prevIsMe && diffPrev < gapLimit && nextIsMe && diffNext < gapLimit) groupPosition = 'middle';
      else if (prevIsMe && diffPrev < gapLimit) groupPosition = 'last';
      else if (nextIsMe && diffNext < gapLimit) groupPosition = 'first';

      results.push({
        ...current,
        groupPosition,
        showAvatar: !isMe && (groupPosition === 'last' || groupPosition === 'single'),
      });

      // Thêm Date Separator nếu cần
      if (prev) {
        if (currDateStr !== prevDateStr) {
          results.push({
            id: `date-${current.id}`,
            type: 'date_separator',
            date: currDateStr,
          });
        }
      } else if (i === sorted.length - 1) {
        results.push({
          id: `date-start`,
          type: 'date_separator',
          date: currDateStr,
        });
      }
    }
    return results;
  }, [messages, currentUserEmail, normalizeEmail]);

  // SCROLL TO MESSAGE LOGIC
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const hasScrolledRef = useRef(false); // [SENIOR] Atomic lock for scrolling
  const scrollRetryCountRef = useRef(0);

  const performScrollToMessage = useCallback(() => {
    if (!targetMessageId || !messagesScrollRef.current || processedMessages.length === 0 || hasScrolledRef.current) {
      return;
    }

    const index = processedMessages.findIndex(m => m.id === targetMessageId || m.SK === targetMessageId);
    
    if (index === -1) {
      if (!isLoadingMessages) console.warn("[ChatScreen] Target not found in window:", targetMessageId);
      return;
    }

    // [SENIOR] ATOMIC LOCK: Set ref immediately to prevent any re-triggering
    hasScrolledRef.current = true;
    setHasScrolledToTarget(true);
    
    console.log("[ChatScreen] JUMPING to index:", index, "Total:", processedMessages.length);
    
    const scroll = () => {
      if (!messagesScrollRef.current) return;
      try {
        messagesScrollRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
        
        setTimeout(() => {
          useChatStore.getState().setTargetMessageId(null);
        }, 3500);
      } catch (err) {
        console.warn("[ChatScreen] scrollToIndex failed, using offset fallback:", err);
        messagesScrollRef.current?.scrollToOffset({
          offset: index * 150, // Slightly larger estimate for fallback
          animated: true
        });
      }
    };

    setTimeout(scroll, 100); 
  }, [targetMessageId, processedMessages, isLoadingMessages]);

  useEffect(() => {
    if (!isLoadingMessages && targetMessageId && !hasScrolledToTarget) {
      const t = setTimeout(performScrollToMessage, 100); // Much faster
      return () => clearTimeout(t);
    }
  }, [isLoadingMessages, targetMessageId, hasScrolledToTarget, performScrollToMessage]);

  useEffect(() => {
    setHasScrolledToTarget(false);
    hasScrolledRef.current = false; // Reset lock when target changes
  }, [targetMessageId]);

  const selectedChat = useMemo(() => {
    const targetId = currentConvId || conversationId;
    if (targetId) {
      return conversations.find(c => c.id === targetId) || localConversation;
    }
    if (targetEmail) {
      const target = normalizeEmail(targetEmail);
      return conversations.find(c => 
        c.type === 'direct' && 
        Array.isArray(c.members) && 
        c.members.some((m: string) => normalizeEmail(m) === target)
      ) || localConversation;
    }
    return localConversation;
  }, [conversations, currentConvId, conversationId, targetEmail, localConversation, normalizeEmail]);

  const loadWallpaper = useCallback(async () => {
    const convId = selectedChat?.id || currentConvId || conversationId;
    setWallpaperId(await getConversationWallpaperId(convId));
  }, [conversationId, currentConvId, selectedChat?.id]);

  useEffect(() => {
    loadWallpaper();
  }, [loadWallpaper]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', loadWallpaper);
    return unsubscribe;
  }, [navigation, loadWallpaper]);

  const isBot = useMemo(() => {
    const pEmail = selectedChat?.partner || (Array.isArray(selectedChat?.members) ? selectedChat.members.find((m: string) => m !== user?.email) : undefined) || targetEmail || '';
    return normalizeEmail(pEmail) === 'bot@unichat.system';
  }, [selectedChat, targetEmail, user?.email, normalizeEmail]);


  const activePinnedMessages = useMemo(() => {
    // [SENIOR] Strictly isolated filter
    if (!selectedChat) return [];
    const ids: string[] = selectedChat?.pinnedMessageIds || [];
    return ids.map(id => {
      const msg = messages.find(m => m.id === id && m.conversationId === selectedChat.id);
      if (msg) return msg;
      const cached = pinnedMessagesCache[id];
      if (cached) return cached;
      return { id, isPlaceholder: true };
    }).slice(0, 3);
  }, [selectedChat, messages, pinnedMessagesCache]);

  // [SENIOR] Parallel hydration of pinned messages
  useEffect(() => {
    if (!selectedChat?.id) return;
    const pinnedIds: string[] = selectedChat.pinnedMessageIds || [];
    const missingIds = pinnedIds.filter(id => 
      !messages.some(m => m.id === id) && 
      !pinnedMessagesCache[id]
    );
    if (missingIds.length > 0) {
      missingIds.forEach(id => fetchMessage(selectedChat.id, id));
    }
  }, [selectedChat?.id, selectedChat?.pinnedMessageIds, messages, pinnedMessagesCache, fetchMessage]);

  // UTILS
  const getDisplayName = useCallback((email: string | null | undefined) => {
    if (!email) return "Người dùng";
    const normalized = normalizeEmail(email);
    
    // Bot display name
    if (normalized === "bot@unichat.system") return "UniChat AI";
    
    // Check if there's an alias for this conversation
    if (selectedChat?.alias) return selectedChat.alias;
    
    if (normalized === normalizeEmail(user?.email)) return "Bạn";
    const p = userProfiles[normalized];
    return p?.nickname || p?.fullName || p?.fullname || normalized;
  }, [userProfiles, user, normalizeEmail, selectedChat?.alias]);

  const getDisplayAvatar = useCallback((email?: string) => {
    const defaultAvatar = "https://ui-avatars.com/api/?name=UniChat&background=0052AA&color=fff&bold=true";
    const normalized = normalizeEmail(email);
    if (!normalized) return defaultAvatar;
    // Bot avatar
    if (normalized === "bot@unichat.system") return "https://api.dicebear.com/9.x/bottts-neutral/png?seed=UniBotPremium&backgroundColor=0284c7,0ea5e9&radius=50";
    if (normalized === normalizeEmail(user?.email)) return user?.avatarUrl || defaultAvatar;
    const profile = userProfiles[normalized];
    return profile?.avatarUrl || profile?.avatar || defaultAvatar;
  }, [userProfiles, user, normalizeEmail]);

  // PERSISTENCE
  const persistMuteSchedules = async (nextMap: Record<string, any>) => {
    const normalized = pruneExpiredSchedules(nextMap);
    setMuteScheduleMap(normalized);
    try {
      await AsyncStorage.setItem(CHAT_MUTE_SCHEDULE_KEY, JSON.stringify(normalized));
    } catch (error) { console.error("Save mute schedule failed", error); }
  };

  useEffect(() => {
    const loadNotificationPrefs = async () => {
      const muteRaw = await AsyncStorage.getItem(CHAT_MUTE_SCHEDULE_KEY);
      if (muteRaw) {
        const parsed = JSON.parse(muteRaw);
        if (parsed) setMuteScheduleMap(pruneExpiredSchedules(parsed));
      }
    };
    loadNotificationPrefs();
  }, []);

  useEffect(() => {
    const syncConversationPreferences = async () => {
      try {
        const [pinnedRaw, hiddenRaw, aliasRaw] = await Promise.all([
          AsyncStorage.getItem(CHAT_PINNED_CONVERSATIONS_KEY),
          AsyncStorage.getItem(CHAT_HIDDEN_CONVERSATIONS_KEY),
          AsyncStorage.getItem(CHAT_ALIAS_CONVERSATIONS_KEY),
        ]);

        const pinnedMap = pinnedRaw ? JSON.parse(pinnedRaw) : {};
        const hiddenMap = hiddenRaw ? JSON.parse(hiddenRaw) : {};
        const aliasMap = aliasRaw ? JSON.parse(aliasRaw) : {};

        setConversations((prev: any[]) => prev.map((conv) => ({
          ...conv,
          pinned: !!pinnedMap?.[conv.id],
          hidden: !!hiddenMap?.[conv.id],
          alias: aliasMap?.[conv.id] || conv.alias || '',
        })));
      } catch (error) {
        console.warn('[ChatScreen] Failed to sync conversation preferences', error);
      }
    };

    syncConversationPreferences();
  }, [setConversations]);

  // INITIALIZATION
  useEffect(() => {
    const initChat = async () => {
      let activeId = conversationId;
      if (!activeId && targetEmail) {
        console.log("[ChatScreen] Starting direct chat with:", targetEmail);
        setIsLoadingMetadata(true);
        try {
          activeId = await startDirectChat(targetEmail);
          if (activeId) setCurrentConvId(activeId);
        } catch (err) {
          console.error('[ChatScreen] startDirectChat FAILED:', err);
        }
        setIsLoadingMetadata(false);
        console.log("[ChatScreen] Got activeId from startDirectChat:", activeId);
      }
      
      console.log("[ChatScreen] activeId for init:", activeId);
      if (activeId) {
        setActiveConversation(activeId, paramTargetMessageId || null);
        
        // Auto-call
        if (startCall) {
          setTimeout(() => {
            handleStartCall(startCall);
          }, 1000);
        }

        if (!conversations.find(c => c.id === activeId)) {
          (async () => {
            setIsLoadingMetadata(true);
            try {
              const res = await chatGet(`/conversations/${encodeURIComponent(activeId)}/metadata`);
              if (res.ok) setLocalConversation(res.data);
            } finally { setIsLoadingMetadata(false); }
          })();
        }
        if (SocketService.socket) SocketService.socket.emit("join_room", { convId: activeId });
        useChatStore.getState().markReadLocal(activeId);
        markNotificationsRead(activeId);
        dismissNotificationsByConversation(activeId).catch(() => {});
        chatPatch(`/conversations/${encodeURIComponent(activeId)}/read`, {}).catch(() => {});
      }
    };

    initChat();

    const reloadBlockStatus = async () => {
      try {
        const res = await chatGet('/friends');
        if (res.ok && res.data) {
          setBlockedFriendships(res.data.filter((f: any) => f.status === 'blocked'));
        }
      } catch (err) {}
    };
    reloadBlockStatus();

    SocketService.on("friendship_updated", reloadBlockStatus);

    return () => {
      SocketService.off("friendship_updated", reloadBlockStatus);
      const idToLeave = currentConvId || conversationId;
      if (SocketService.socket && idToLeave) {
        SocketService.socket.emit("leave_room", { convId: idToLeave });
      }
      setActiveConversation(null);
    };
  }, [conversationId, targetEmail, startCall]);

  // Load partner profile if missing
  useEffect(() => {
    if (selectedChat?.type === 'direct' && selectedChat?.members) {
      const partnerEmail = selectedChat.members.find((m: string) => normalizeEmail(m) !== normalizeEmail(user?.email));
      if (partnerEmail && !userProfiles[normalizeEmail(partnerEmail)]) {
        useChatStore.getState().loadUserProfile(partnerEmail);
      }
    }
  }, [selectedChat, user?.email, userProfiles, normalizeEmail]);

  // SOCKET EVENTS
  useEffect(() => {
    const socket = SocketService.socket;
    if (!socket) return;
    const handleTyping = (data: any) => {
      if (data.convId !== (currentConvId || conversationId) || data.email === user?.email) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        data.isTyping ? next.add(data.email) : next.delete(data.email);
        return next;
      });
    };
    const handleMessageReaction = (data: any) => { if (data.messageId) updateMessage(data.messageId, { reactions: data.reactions }); };
    const handleMessageUpdate = (data: any) => {
      if (data.convId === (currentConvId || conversationId) || data.conversationId === (currentConvId || conversationId)) {
        updateMessage(data.messageId || data.id, data.updates || data);
      }
    };
    const handleMessageDelete = (data: any) => {
      if (data.convId === (currentConvId || conversationId) || data.conversationId === (currentConvId || conversationId)) {
        useChatStore.getState().setMessages((prev: any[]) => prev.filter(m => m.id !== (data.messageId || data.id)));
      }
    };
    const handleReceiveMessage = (data: any) => {
      const convId = data.conversationId || data.convId;
      if (convId === (currentConvId || conversationId)) {
        console.log(`[ChatScreen] Received message in active chat:`, data.id);
        useChatStore.getState().addMessage(data);
      }
    };
    const handlePinUpdate = (data: any) => {
      const convId = data.conversationId || data.convId;
      if (convId && data.pinnedMessageIds) {
        useChatStore.getState().updateConversationById(convId, {
          pinnedMessageIds: data.pinnedMessageIds,
        });
      }
    };
    const handleGroupUpdate = (data: any) => {
      if (data.convId === (currentConvId || conversationId) || data.id === (currentConvId || conversationId)) {
        setConversations((prev: any[]) => prev.map(c => c.id === data.id ? { ...c, ...data.updates } : c));
        if (data.updates) {
          setLocalConversation((prev: any) => prev ? { ...prev, ...data.updates } : null);
        }
      }
    };
    const handleGroupDissolve = (data: any) => {
      if (data.convId === (currentConvId || conversationId) || data.id === (currentConvId || conversationId)) {
        Alert.alert("Thông báo", "Nhóm đã bị giải tán bởi trưởng nhóm.");
        if (goBack) goBack();
      }
    };
    const handleConversationUpdated = (data: any) => {
      const convId = data.conversationId || data.convId || data.id;
      if (convId === (currentConvId || conversationId)) {
        const finalUpdates = { ...data.updates };
        if (finalUpdates.unreadCount !== undefined) {
          finalUpdates.unreadCount = 0;
        }

        setConversations((prev: any[]) => prev.map(c => c.id === convId ? { ...c, ...finalUpdates } : c));
        if (data.updates) {
          setLocalConversation((prev: any) => prev ? { ...prev, ...finalUpdates } : null);
        }
      }
    };
    socket.on("typing", handleTyping);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("message_update", handleMessageUpdate);
    socket.on("message_delete", handleMessageDelete);
    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("PIN_UPDATE", handlePinUpdate);
    socket.on("group_updated", handleGroupUpdate);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("group_dissolved", handleGroupDissolve);
    return () => {
      socket.off("typing", handleTyping);
      socket.off("message_reaction", handleMessageReaction);
      socket.off("message_update", handleMessageUpdate);
      socket.off("message_delete", handleMessageDelete);
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("PIN_UPDATE", handlePinUpdate);
      socket.off("group_updated", handleGroupUpdate);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("group_dissolved", handleGroupDissolve);
    };
  }, [currentConvId, conversationId, currentUserEmail, updateMessage, setConversations]);

  const handleReply = useCallback((message: any) => {
    const senderEmail = normalizeEmail(message.senderId);
    const senderName = (() => {
      if (senderEmail === normalizeEmail(currentUserEmail)) return "Bạn";
      const p = userProfiles?.[senderEmail];
      return p?.nickname || p?.fullName || p?.fullname || senderEmail;
    })();
    setReplyTarget({ ...message, senderName });
  }, [currentUserEmail, userProfiles, normalizeEmail]);

  const handleViewMessageDetail = useCallback((message: any) => {
    const senderEmail = normalizeEmail(message.senderId);
    const senderName = senderEmail === normalizeEmail(currentUserEmail)
      ? 'Bạn'
      : (userProfiles?.[senderEmail]?.nickname || userProfiles?.[senderEmail]?.fullName || userProfiles?.[senderEmail]?.fullname || senderEmail || 'Người dùng');
    const senderAvatar = senderEmail === normalizeEmail(currentUserEmail)
      ? (user?.avatarUrl || '')
      : (userProfiles?.[senderEmail]?.avatarUrl || userProfiles?.[senderEmail]?.avatar || '');
    setDetailMessage({ ...message, senderName, senderAvatar });
  }, [currentUserEmail, normalizeEmail, userProfiles]);

  const handleMarkMessage = useCallback((message: any) => {
    updateMessage(message.id, { marked: !message.marked });
    Alert.alert('Đã cập nhật', message.marked ? 'Đã bỏ đánh dấu tin nhắn.' : 'Tin nhắn đã được đánh dấu.');
  }, [updateMessage]);

  const handleStartMultiSelect = useCallback((message: any) => {
    setIsMultiSelectMode(true);
    setSelectedMessageIds((prev) => prev.includes(message.id) ? prev : [...prev, message.id]);
  }, []);

  const handleToggleSelectedMessage = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => (
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    ));
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedMessageIds([]);
  }, []);

  const handleDeleteSelectedMessages = useCallback(async () => {
    if (!selectedChat?.id || selectedMessageIds.length === 0) return;
    await Promise.all(selectedMessageIds.map((id) => deleteMessageOptimistic(selectedChat.id, id)));
    exitMultiSelectMode();
  }, [deleteMessageOptimistic, exitMultiSelectMode, selectedChat?.id, selectedMessageIds]);

  const handleCopySelectedMessages = useCallback(async () => {
    const selected = messages.filter((message) => selectedMessageIds.includes(message.id));
    const text = selected.map((message) => `${getDisplayName(message.senderId)}: ${message.content || '[Đính kèm]'}`).join('\n');
    if (text) {
      await Clipboard.setStringAsync(text);
      Alert.alert('Đã sao chép', 'Nội dung các tin nhắn đã được sao chép.');
    }
  }, [getDisplayName, messages, selectedMessageIds]);

  const handleMarkSelectedMessages = useCallback(() => {
    selectedMessageIds.forEach((messageId) => {
      const message = messages.find((item) => item.id === messageId);
      if (message) updateMessage(messageId, { marked: !message.marked });
    });
    Alert.alert('Đã cập nhật', `Đã đánh dấu ${selectedMessageIds.length} tin nhắn.`);
  }, [messages, selectedMessageIds, updateMessage]);

  const handlePinSelectedMessages = useCallback(() => {
    selectedMessageIds.forEach((messageId) => {
      const message = messages.find((item) => item.id === messageId);
      if (message) patchMessageOptimistic(selectedChat.id, messageId, { action: message.pinned ? 'unpin' : 'pin' });
    });
    Alert.alert('Đã cập nhật', `Đã xử lý ghim cho ${selectedMessageIds.length} tin nhắn.`);
  }, [messages, patchMessageOptimistic, selectedChat?.id, selectedMessageIds]);

  // HANDLERS
  const isVideo = (a: any) => {
    const mime = String(a.mimeType || a.fileType || "").toLowerCase();
    const name = String(a.name || a.fileName || "").toLowerCase();
    return mime.startsWith("video/") || /\.(mp4|mov|avi|wmv|webm|mkv|3gp|flv|m4v)(\?.*)?$/.test(name);
  };
  const isImage = (a: any) => {
    const mime = String(a.mimeType || a.fileType || "").toLowerCase();
    const name = String(a.name || a.fileName || "").toLowerCase();
    return mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic|heif)(\?.*)?$/.test(name);
  };

  const handleChatSend = async (content: string, attachments: any[], mentions: MentionPayload[] = []) => {
    const chatId = selectedChat?.id || conversationId;
    if (!chatId || !user?.email) return;

    // 1. PRE-CLASSIFY ATTACHMENTS FOR OPTIMISTIC UI
    const optimisticMedia = attachments.filter(a => isImage(a) || isVideo(a)).map(a => ({
      ...a,
      url: a.dataUrl,
      status: 'sending'
    }));
    const optimisticFiles = attachments.filter(a => !isImage(a) && !isVideo(a)).map(a => ({
      ...a,
      url: a.dataUrl,
      status: 'sending'
    }));

    const isAudio = attachments.some(a => {
      const mime = String(a.mimeType || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      return mime.startsWith("audio/") && (name.startsWith("audio_") || name.startsWith("voice-"));
    });
    
    let messageType: any = "text";
    if (isAudio) messageType = "audio";
    else if (optimisticMedia.length > 0) {
      if (optimisticMedia.length === 1) {
        messageType = isImage(optimisticMedia[0]) ? "image" : "video";
      } else {
        messageType = "media";
      }
    } else if (optimisticFiles.length > 0) {
      messageType = "file";
    }

    const replyToData = replyTarget ? {
      id: replyTarget.id,
      content: replyTarget.content,
      senderId: replyTarget.senderId,
      media: replyTarget.media,
      files: replyTarget.files
    } : undefined;

    const messageMentions = mentions.map((mention) => ({
      email: String(mention.email || '').replace(/^USER#/i, '').trim().toLowerCase(),
      displayName: mention.displayName,
      start: mention.start,
      end: mention.end,
    })).filter((mention) => mention.email);

    const tempId = await sendMessageOptimistic(chatId, {
      content,
      type: messageType,
      replyTo: replyToData,
      media: optimisticMedia,
      files: optimisticFiles,
      extraFields: messageMentions.length > 0 ? { mentions: messageMentions } : undefined,
      skipApi: true
    });

    setReplyTarget(null);

    // 2. BACKGROUND UPLOAD AND SEND
    (async () => {
      try {
        const uploaded = [];
        let uploadFailed = false;

        for (const item of attachments) {
          if (item.name === 'location.json' || item.name === 'contact.json' || item.isSticker) {
            uploaded.push({ ...item, fileUrl: item.dataUrl || item.uri });
            continue;
          }

          const uploadUri = item.dataUrl || item.uri || (item.file?.uri);
          if (!uploadUri) continue;

          if (uploadUri.startsWith('http://') || uploadUri.startsWith('https://')) {
            uploaded.push({ ...item, fileUrl: uploadUri });
            continue;
          }

          console.log(`[ChatScreen] Uploading attachment: ${item.name}`);
          const res = await chatUpload(item.file || { uri: uploadUri, name: item.name, type: item.mimeType });
          
          if (res.ok && res.data && res.data.fileUrl) {
            uploaded.push({ ...item, ...res.data });
          } else {
            console.error(`[ChatScreen] Upload failed or missing fileUrl for ${item.name}`, res.error);
            uploadFailed = true;
            break;
          }
        }

        if (uploadFailed) {
          updateMessage(tempId, { status: "error" });
          return;
        }

        const media = uploaded.filter(a => isImage(a) || isVideo(a)).map(a => ({
          url: a.fileUrl || a.url || a.dataUrl,
          dataUrl: a.fileUrl || a.url || a.dataUrl,
          name: a.name || a.fileName,
          mimeType: a.mimeType || a.fileType,
          size: a.size,
          isSticker: a.isSticker === true,
          isHD: a.isHD === true,
        }));

        const files = uploaded.filter(a => !isImage(a) && !isVideo(a)).map(a => ({
          url: a.fileUrl || a.url || a.dataUrl,
          dataUrl: a.fileUrl || a.url || a.dataUrl,
          name: a.name || a.fileName,
          mimeType: a.mimeType || a.fileType,
          size: a.size,
        }));

        const audioFile = uploaded.find(a => {
          const mime = String(a.mimeType || a.fileType || "").toLowerCase();
          const name = String(a.name || a.fileName || "").toLowerCase();
          return mime.startsWith("audio/") && (name.startsWith("audio_") || name.startsWith("voice-"));
        });
        const audioUrl = audioFile ? (audioFile.fileUrl || audioFile.url || audioFile.dataUrl) : undefined;

        const payload: any = {
          content: content || (audioUrl ? "[Tin nhắn thoại]" : (media.length > 0 ? "[Ảnh/Video]" : (files.length > 0 ? "[Tệp tin]" : ""))),
          type: audioUrl ? 'audio' : (media.length > 0 && files.length === 0) ? (media.length === 1 ? (isImage(media[0]) ? 'image' : 'video') : 'media') : (files.length > 0 || media.length > 0) ? 'media' : 'text',
          media: media.length > 0 ? media : undefined,
          files: files.length > 0 ? files : undefined,
          audioUrl,
          replyTo: replyToData,
          mentions: messageMentions.length > 0 ? messageMentions : undefined
        };

        const res = await chatPost(`/conversations/${encodeURIComponent(chatId)}/messages`, payload);
        if (res.ok && res.data) {
          console.log(`[ChatScreen] Background send success for ${tempId}`);
          updateMessage(tempId, { ...res.data, status: "sent" });
        } else {
          console.error(`[ChatScreen] Background send failed for ${tempId}`, res.error);
          updateMessage(tempId, { status: "error" });
        }
      } catch (err) {
        console.error(`[ChatScreen] Critical error in background send:`, err);
        updateMessage(tempId, { status: "error" });
      }
    })();
  };

  const handleSendPoll = async (poll: { topic: string; options: string[]; allowMultiple?: boolean; allowAddOption?: boolean }) => {
    if (!selectedChat?.id) return;
    try {
      await sendMessageOptimistic(selectedChat.id, {
        content: `[Bình chọn: ${poll.topic}]`,
        type: "poll",
        payload: {
          poll: {
            topic: poll.topic,
            options: poll.options,
            allowMultiple: poll.allowMultiple || false,
            allowAddOption: poll.allowAddOption || false,
            votes: {},
            isClosed: false
          }
        }
      });
    } catch (err) {
      console.error("Failed to send poll", err);
    }
  };

  const handleVotePoll = async (messageId: string, optionIndex: number) => {
    if (!selectedChat?.id) return;
    try {
      // Use the store action directly for consistency
      await useChatStore.getState().votePoll(selectedChat.id, messageId, optionIndex);
    } catch (err) {
      console.error("Failed to vote poll", err);
    }
  };

  const handleClosePoll = async (messageId: string) => {
    if (!selectedChat?.id) return;
    try {
      await useChatStore.getState().closePoll(selectedChat.id, messageId);
    } catch (err) {
      console.error("Failed to close poll", err);
    }
  };

  const handleSendReminder = async (reminder: { title: string; date: string; time: string; repeatType: any; audience: "self" | "group" }) => {
    if (!selectedChat?.id) return;
    try {
      await sendMessageOptimistic(selectedChat.id, {
        content: `[Nhắc hẹn: ${reminder.title}]`,
        type: "reminder",
        payload: {
          reminder: {
            title: reminder.title,
            content: reminder.title, // Add content as well for web compatibility
            date: reminder.date,
            time: reminder.time,
            repeatType: reminder.repeatType,
            audience: reminder.audience
          }
        }
      });
    } catch (err) {
      console.error("Failed to send reminder", err);
    }
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!selectedChat) return;

    if (Platform.OS === 'android') {
      try {
        const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!hasAudio) {
          const grantedAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) return;
        }
        if (type === 'video') {
          const hasVideo = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          if (!hasVideo) {
            const grantedVideo = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (grantedVideo !== PermissionsAndroid.RESULTS.GRANTED) return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    const activeCallId = uuidv4();

    if (selectedChat.type === 'direct') {
      const partnerEmail = selectedChat.partner || (Array.isArray(selectedChat.members) ? selectedChat.members.find((m: string) => m !== user?.email) : undefined);
      if (!partnerEmail) return Alert.alert('Lỗi', 'Không tìm thấy thông tin đối phương');
      
      startOutgoingCall({ email: partnerEmail, fullName: getDisplayName(partnerEmail), avatarUrl: getDisplayAvatar(partnerEmail) }, type, selectedChat.id, activeCallId);
      const res = await apiPost('/call/create', { conversationId: selectedChat.id, callId: activeCallId, type });
      if (res.ok) {
        setMeetingInfo(res.meeting, res.attendee);
        SocketService.socket?.emit('call:invite', { convId: selectedChat.id, callId: activeCallId, fromEmail: user.email, toEmail: partnerEmail, callerProfile: { email: user.email, fullName: user.fullName || user.email, avatarUrl: user.avatarUrl }, callType: type });
      } else { resetCall(); Alert.alert('Lỗi', 'Không thể khởi tạo cuộc gọi'); }
    } else {
      // Group Call
      const recipientEmails = Array.isArray(selectedChat.members) 
          ? selectedChat.members.filter((m: string) => m !== user?.email)
          : [];

      try {
        const res = await useGroupCallStore.getState().initiateGroupCall(
          selectedChat.id, 
          activeCallId, 
          type, 
          recipientEmails, 
          { email: user?.email, name: user?.name, avatar: user?.avatarUrl || user?.avatar },
          selectedChat.name,
          selectedChat.avatar
        );
        
        if (res.meeting && res.attendee) {
          useGroupCallStore.getState().startJoining(selectedChat.id, activeCallId, type, selectedChat.name, selectedChat.avatar, recipientEmails);
          
          SocketService.socket?.emit('group-call:invite', {
            convId: selectedChat.id,
            callId: activeCallId,
            callType: type,
            fromEmail: user?.email,
            recipients: recipientEmails,
            callerProfile: { email: user?.email, name: user?.name, avatar: user?.avatarUrl || user?.avatar },
            groupName: selectedChat.name,
            groupAvatar: selectedChat.avatar
          });
        }
      } catch (e) {
        Alert.alert('Lỗi', 'Không thể khởi tạo cuộc gọi nhóm');
      }
    }
  };

  const handleJoinCall = async (callId: string, type: string) => {
    if (!selectedChat) return;

    if (Platform.OS === 'android') {
      try {
        const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!hasAudio) {
          const grantedAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) return;
        }
        if (type === 'video') {
          const hasVideo = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          if (!hasVideo) {
            const grantedVideo = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (grantedVideo !== PermissionsAndroid.RESULTS.GRANTED) return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (selectedChat.type === 'group') {
      try {
        const { apiPost } = require('../../utils/api');
        const { useGroupCallStore } = require('../../store/groupCallStore');
        const res = await apiPost('/group-call/join', {
          conversationId: selectedChat.id,
          callId
        });

        if (res.meeting && res.attendee) {
          useGroupCallStore.getState().setMeetingData(res.meeting, res.attendee);
          useGroupCallStore.getState().startJoining(selectedChat.id, callId, type, selectedChat.name, selectedChat.avatar);
          useGroupCallStore.getState().toggleMinimized(false);
          if (res.participants) {
            useGroupCallStore.getState().setParticipants(res.participants);
          }
        } else {
          Alert.alert('Lỗi', 'Không thể tham gia cuộc gọi');
        }
      } catch (e: any) {
        Alert.alert('Lỗi', e.message || 'Không thể tham gia cuộc gọi');
      }
    }
  };

  const toggleReaction = async (message: any, emoji: string) => {
    if (!user?.email || !selectedChat?.id) return;
    const isRemove = message.reactions?.[emoji]?.includes(user.email);
    patchMessageOptimistic(selectedChat.id, message.id, { action: "react", reactAction: isRemove ? 'remove' : 'add', emoji });
  };

  const handlePinMessage = async (message: any) => {
    if (!selectedChat?.id) return;
    const isPin = !message.pinned;
    patchMessageOptimistic(selectedChat.id, message.id, { action: isPin ? "pin" : "unpin" });
  };

  const handleSelectMuteSchedule = async (type: string) => {
    if (!selectedChat?.id) return;
    setShowMuteMenuModal(false);
    const nextMap: Record<string, any> = { ...muteScheduleMap };
    if (type === "unmute") delete nextMap[selectedChat.id];
    else if (type === "1h") nextMap[selectedChat.id] = createMuteUntilHours(1);
    else if (type === "4h") nextMap[selectedChat.id] = createMuteUntilHours(4);
    else if (type === "12h") nextMap[selectedChat.id] = createMuteUntilHours(12);
    else if (type === "custom") return setShowCustomMuteModal(true);
    else nextMap[selectedChat.id] = createMuteUntilMorning(8);
    try {
      await persistMuteSchedules(nextMap);
      if (type === "unmute") {
        await useChatStore.getState().clearConversationMuted(selectedChat.id);
      } else {
        await useChatStore.getState().muteConversationFor(
          selectedChat.id,
          type === "1h" ? "1h" : type === "4h" ? "4h" : type === "12h" ? "12h" : "until-8am",
        );
      }
      Alert.alert("Thông báo", getMuteLabel(nextMap[selectedChat.id]));
    } catch {
      Alert.alert("Không thể cập nhật", "Vui lòng thử lại sau.");
    }
  };

  if (!selectedChat) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, color: Colors.primary }}>Đang tải cuộc hội thoại...</Text>
      </View>
    );
  }

  const partner = selectedChat.partner || (Array.isArray(selectedChat.members) ? selectedChat.members.find((m: string) => m !== user?.email) : undefined);

  const partnerProfile = userProfiles[normalizeEmail(partner)];
  const isOnline = selectedChat?.type === 'direct' && partnerProfile?.status === 'online';
  const typingText = typingUsers.size > 0 
    ? `${getDisplayName([...typingUsers][0])} đang gõ...` 
    : (isBot 
        ? "Trợ lý AI của bạn"
        : (selectedChat?.type === 'direct' 
            ? (partnerProfile?.statusMessage || partnerProfile?.currentStatus || (isOnline ? "Đang hoạt động" : "Vừa mới truy cập")) 
            : `${selectedChat?.members?.length || 0} thành viên`));

  const blockedRelation = partner 
    ? blockedFriendships.find((f: any) => normalizeEmail(f.sender_id) === normalizeEmail(partner) || normalizeEmail(f.receiver_id) === normalizeEmail(partner))
    : null;
  const isBlocked = !!blockedRelation;
  const iBlockedThem = blockedRelation?.blockedBy === user?.email;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#fff' }}>
      
      {/* 1. SIDEBAR (Chỉ hiện trên màn hình lớn - Giống bản Web) */}
      {isLargeScreen && (
        <View style={{ width: 350, borderRightWidth: 1, borderRightColor: '#eee', backgroundColor: '#f9f9f9' }}>
           <View style={{ paddingTop: insets.top, flex: 1 }}>
              <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold' }}>Tin nhắn</Text>
              </View>
              <ConversationList 
                conversations={conversations}
                loading={false}
                currentUserEmail={user?.email || ""}
                userProfiles={userProfiles}
                tags={[]}
                onSelectChat={(chat) => {
                  if (onNavigate) onNavigate('Chat', { conversationId: chat.id });
                }}
                onLongPressChat={() => {}}
                getDisplayName={getDisplayName}
                getDisplayAvatar={getDisplayAvatar}
                getConversationPreview={(conv) => conv.lastMessageContent || "Chưa có tin nhắn"}
              />

           </View>
        </View>
      )}

      {/* 2. CHAT AREA (Logic cũ của bạn) */}
      <View style={styles.container}>
        <ImageBackground 
          source={getChatWallpaperSource(wallpaperId)}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {/* Subtle overlay for mobile too */}
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
            style={{ flex: 1 }}
          >

            <View style={{ flex: 1 }}>
              <ChatHeader 
          insets={insets} goBack={goBack} selectedChat={selectedChat}
          displayName={selectedChat.type === 'direct' ? getDisplayName(partner) : selectedChat.name}
          displayAvatar={selectedChat.type === 'direct' ? getDisplayAvatar(partner) : (selectedChat.avatar || getDisplayAvatar())}
          isOnline={selectedChat.type === 'direct' && userProfiles[partner]?.status === 'online'}
          typingText={typingText} onStartCall={handleStartCall}
          onOpenDetails={() => {
            if (onNavigate) onNavigate('ChatDetails', { conversationId: selectedChat.id });
          }}
          isBot={isBot}
        />

        <PinBanner 
          activePinnedMessages={activePinnedMessages} isPinsExpanded={isPinsExpanded} setIsPinsExpanded={setIsPinsExpanded}
          onJumpToMessage={(id) => setActiveConversation(selectedChat.id, id)}
          onUnpin={(id) => chatPatch(`/conversations/${encodeURIComponent(selectedChat.id)}/messages/${encodeURIComponent(id)}`, { action: "unpin" })}
        />

        <View style={{ flex: 1 }}>
          <FlatList
            ref={messagesScrollRef}
            data={processedMessages}
            inverted
            keyExtractor={(m) => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 10, paddingBottom: 10 }}
            initialNumToRender={targetMessageId ? 80 : 20}
            windowSize={targetMessageId ? 61 : 21}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollToBottom(y > 300);

            // [SENIOR] Load NEWER messages when scrolling to the bottom (y near 0 in inverted list)
            if (y < 200 && prevCursor && !isLoadingMessages && selectedChat?.id) {
              fetchNewerMessages(selectedChat.id, 30, fetchToken);
            }
          }}
          onContentSizeChange={() => {
            if (targetMessageId && !hasScrolledToTarget) {
              performScrollToMessage();
            }
          }}
          onEndReached={() => selectedChat?.id && nextCursor && !isLoadingMessages && fetchMoreMessages(selectedChat.id, 30, fetchToken)}
          onEndReachedThreshold={0.5}
          onScrollToIndexFailed={(info) => {
            if (scrollRetryCountRef.current > 3) {
              console.warn("[ChatScreen] Max scroll retries reached, giving up to prevent loop.");
              setHasScrolledToTarget(true); // Mark as done to stop attempts
              return;
            }
            scrollRetryCountRef.current += 1;
            console.warn("[ChatScreen] Scroll failed, retrying...", info.index, "attempt", scrollRetryCountRef.current);
            messagesScrollRef.current?.scrollToOffset({ 
              offset: info.averageItemLength * info.index, 
              animated: false 
            });
            setTimeout(() => {
              messagesScrollRef.current?.scrollToIndex({ 
                index: info.index, 
                animated: true, 
                viewPosition: 0.5 
              });
            }, 500);
          }}
          renderItem={({ item: m }) => {
            if (m.type === 'date_separator') {
              return (
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase' }}>
                    {m.date === new Date().toDateString() ? "Hôm nay" : m.date}
                  </Text>
                </View>
              );
            }
            if (m.type === 'call' || m.type === 'SYSTEM_CALL' || (m.type === 'system' && m.content?.includes('Cuộc gọi'))) return <SystemCallMessageItem message={m} currentUserEmail={user?.email} onCallBack={handleStartCall} onJoinCall={handleJoinCall} />;
            if (m.type === 'system') return <SystemNotificationItem message={m} onJump={(id) => setActiveConversation(selectedChat.id, id)} />;
            
            // Tìm xem đối phương đã đọc đến đây chưa (Messenger Style: Hiện Avatar seen dưới tin nhắn của MÌNH)
            const isSeen = m.senderId === user?.email && m.id === selectedChat.lastReadMessageId;

            return (
              <MessageBubble 
                message={m} 
                isMe={normalizeEmail(m.senderId) === normalizeEmail(currentUserEmail)} 
                userProfile={userProfiles[normalizeEmail(m.senderId)]} 
                userProfiles={userProfiles} 
                onLongPress={setActionMessage} 
                onPress={isMultiSelectMode ? (msg) => handleToggleSelectedMessage(msg.id) : undefined}
                onReaction={toggleReaction} 
                onReply={handleReply} 
                onReplyPress={(id) => setActiveConversation(selectedChat.id, id)} 
                onSystemMessagePress={(id) => setActiveConversation(selectedChat.id, id)} 
                isHighlighted={!!targetMessageId && (m.id === targetMessageId || m.SK === targetMessageId)}
                showAvatar={m.showAvatar}
                groupPosition={m.groupPosition}
                isSeen={isSeen}
                onNavigate={onNavigate}
                isSelectionMode={isMultiSelectMode}
                isSelected={selectedMessageIds.includes(m.id)}
                onVotePoll={handleVotePoll}
                onClosePoll={handleClosePoll}
              />
            );
          }}
        />

        {isMultiSelectMode && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderTopWidth: 1, borderTopColor: '#dbeafe' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8' }}>
                Đã chọn {selectedMessageIds.length} tin nhắn
              </Text>
              <TouchableOpacity onPress={exitMultiSelectMode} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Hủy chọn</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={handleCopySelectedMessages} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#8b5cf6' }}>Sao chép</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMarkSelectedMessages} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f0fdf4' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>Đánh dấu</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePinSelectedMessages} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fefce8' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#ca8a04' }}>Ghim</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteSelectedMessages} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ef4444' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showScrollToBottom && (
          <TouchableOpacity 
            style={styles.scrollToBottomBtn} 
            onPress={() => {
              if (targetMessageId || prevCursor) {
                // Return to latest
                console.log("[ChatScreen] Manual return to latest for:", conversationId);
                if (conversationId) {
                  setHasScrolledToTarget(false);
                  hasScrolledRef.current = false;
                  setActiveConversation(conversationId, null);
                }
              } else {
                messagesScrollRef.current?.scrollToOffset({ offset: 0, animated: true });
              }
            }}
          >
            {(targetMessageId || prevCursor) && (
              <View style={styles.jumpToLatestBadge}>
                <Text style={styles.jumpToLatestText}>Về tin mới nhất</Text>
              </View>
            )}
            <Text style={styles.scrollToBottomIcon}>arrow_downward</Text>
          </TouchableOpacity>
        )}
        </View>
          </View>

          {isBlocked ? (
            <View style={{ padding: 16, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#e2e8f0', alignItems: 'center', paddingBottom: Math.max(insets.bottom, 16) }}>
              <Text style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', marginBottom: iBlockedThem ? 12 : 0 }}>
                {iBlockedThem ? "Bạn đã chặn người dùng này. Bạn sẽ không thể gửi tin nhắn cho họ." : "Người dùng này không thể nhận tin nhắn lúc này."}
              </Text>
              {iBlockedThem && (
                <TouchableOpacity
                  style={{ backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                  onPress={async () => {
                    try {
                      const res = await chatPost('/friends/unblock', { targetEmail: partner });
                      if (res.ok) {
                        setBlockedFriendships(prev => prev.filter(f => normalizeEmail(f.sender_id) !== normalizeEmail(partner) && normalizeEmail(f.receiver_id) !== normalizeEmail(partner)));
                        Alert.alert("Thành công", "Đã bỏ chặn người dùng.");
                      } else {
                        Alert.alert("Lỗi", "Không thể bỏ chặn.");
                      }
                    } catch (err) {
                      Alert.alert("Lỗi", "Không thể bỏ chặn.");
                    }
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Bỏ chặn</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ChatInput 
              key={`input-${selectedChat.id}`} 
              onSendMessage={handleChatSend} 
              replyTarget={replyTarget} 
              onClearReply={() => setReplyTarget(null)}
              onTyping={() => { if (SocketService.socket && selectedChat.id && !typingTimeoutRef.current) { SocketService.socket.emit("typing", { convId: selectedChat.id, isTyping: true }); typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000); } }}
              onOpenPollModal={() => setIsPollModalOpen(true)}
              onOpenReminderModal={() => setIsReminderModalOpen(true)}
              isBot={isBot}
              conversationType={selectedChat?.type}
              members={selectedChat?.members || []}
              userProfiles={userProfiles}
              currentUserEmail={user?.email || currentUserEmail}
            />
          )}

        {/* TARGETING MESSAGE OVERLAY */}
        {isLoadingMessages && targetMessageId && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
            <ActivityIndicator size="large" color="#0084ff" />
            <Text style={{ marginTop: 12, fontWeight: '600', color: '#0084ff' }}>Đang tìm vị trí tin nhắn...</Text>
          </View>
        )}

        <ChatModals 

        actionMessage={actionMessage} setActionMessage={setActionMessage} detailMessage={detailMessage} setDetailMessage={setDetailMessage} onReaction={toggleReaction} onReply={handleReply} 
        onForward={(m) => { setActionMessage(null); setIsForwardModalOpen(true); }}
        onRecall={(m) => patchMessageOptimistic(selectedChat.id, m.id, { action: 'recall' })}
        onDelete={(m) => deleteMessageOptimistic(selectedChat.id, m.id)}
        onPin={handlePinMessage}
        onMark={handleMarkMessage}
        onViewDetail={handleViewMessageDetail}
        onStartMultiSelect={handleStartMultiSelect}
        userEmail={currentUserEmail || ""} showMuteMenuModal={showMuteMenuModal} setShowMuteMenuModal={setShowMuteMenuModal}
        onSelectMuteSchedule={handleSelectMuteSchedule} showCustomMuteModal={showCustomMuteModal} setShowCustomMuteModal={setShowCustomMuteModal}
        customMuteStartTime={customMuteStartTime} setCustomMuteStartTime={setCustomMuteStartTime} customMuteEndTime={customMuteEndTime} setCustomMuteEndTime={setCustomMuteEndTime}
        onApplyCustomMuteSchedule={async () => {
          if (!isValidTimeString(customMuteStartTime) || !isValidTimeString(customMuteEndTime)) return Alert.alert("Lỗi", "Giờ không hợp lệ");
          const nextMap: Record<string, any> = { ...muteScheduleMap, [selectedChat.id]: createCustomWindowMuteSchedule(customMuteStartTime, customMuteEndTime) };
          try {
            await persistMuteSchedules(nextMap);
            await useChatStore.getState().setConversationMuted(selectedChat.id, true);
            setShowCustomMuteModal(false);
            Alert.alert("Thông báo", getMuteLabel(nextMap[selectedChat.id]));
          } catch {
            Alert.alert("Không thể cập nhật", "Vui lòng thử lại sau.");
          }
        }}
      />

      <ForwardModal 
        visible={isForwardModalOpen} 
        onClose={() => setIsForwardModalOpen(false)} 
        message={actionMessage}
        onForward={(targetId) => sendMessageOptimistic(targetId, { 
          content: actionMessage.content, 
          type: actionMessage.type, 
          media: actionMessage.media, 
          files: actionMessage.files 
        })}
      />

      <Modal visible={isPollModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <PollComposer 
            onClose={() => setIsPollModalOpen(false)}
            onCreate={(p) => {
              handleSendPoll(p);
              setIsPollModalOpen(false);
            }}
          />
        </View>
      </Modal>

      <Modal visible={isReminderModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ReminderComposer 
            onClose={() => setIsReminderModalOpen(false)}
            onCreate={(r) => {
              handleSendReminder(r);
              setIsReminderModalOpen(false);
            }}
          />
        </View>
      </Modal>
      </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  </View>
  );
}
