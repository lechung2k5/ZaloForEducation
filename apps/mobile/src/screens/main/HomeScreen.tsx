import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import {
  View,
  Text,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  PermissionsAndroid,
  TouchableOpacity,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStyles } from './style/HomeScreen.styles';
import { useTheme } from '../../context/ThemeContext';
import Alert from '../../utils/Alert';
import { useAuth } from '../../context/AuthContext';

import { getMessagePreview } from '../../utils/chatUtils';
import { useChatStore } from '../../store/chatStore';
import { useConversations } from "../../hooks/queries/useConversations";
import { useCallStore } from "../../store/callStore";
import ContactsScreen from './ContactsScreen';
import NotificationScreen from "./NotificationScreen";
import { HomeHeader } from "../../components/home/HomeHeader";
import { ConversationList } from "../../components/home/ConversationList";
import { MessageActionSheet } from "../../components/home/MessageActionSheet";
import { InboxActionSheet } from "../../components/home/InboxActionSheet";
import { ClassifyFilterModal } from "../../components/home/ClassifyFilterModal";
import { ConversationTagPicker } from "../../components/home/ConversationTagPicker";
import { PinModal } from "../../components/home/PinModal";
import { ProfileTab } from "../../components/home/ProfileTab";
import { Conversation, Message } from "../../store/types";
import { BOT_EMAIL } from "../../constants/bot";
import { ASSETS } from "../../utils/assets";

const TAB_ALIAS: Record<string, string> = {
  messages: "chat",
  chat: "chat",
  contacts: "contacts",
  ai: "ai",
  notifications: "notifications",
  profile: "profile",
};

const normalizeHomeTab = (tab: string) => TAB_ALIAS[String(tab || "").trim().toLowerCase()] || "chat";

const DEFAULT_AVATAR = ASSETS.DEFAULT_AVATAR;

export default function HomeScreen({
  navigation,
  route,
  params: directParams,
}: any) {
  const insets = useSafeAreaInsets();
  const { colors, t, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { user, profileVersion, checkSessionStatus, logout }: any = useAuth();
  
  const { 
    conversations, 
    fetchConversations, 
    setActiveConversation, 
    unreadNotificationCount,
    userProfiles,
    upsertProfiles,
    loadUserProfile,
    tags,
    hiddenConversations,
    loadLocalData
  } = useChatStore();

  const { refetch: refetchConversations, isFetching: isRefreshing } = useConversations();
  const { startOutgoingCall, resetCall, setMeetingInfo }: any = useCallStore();

  const initialTab = directParams?.tab || route.params?.tab || "messages";
  const [activeTab, setActiveTab] = useState(normalizeHomeTab(initialTab));
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [friendSearchEmail, setFriendSearchEmail] = useState("");
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [actionConv, setActionConv] = useState<Conversation | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Inbox Parity States
  const [chatFilter, setChatFilter] = useState<"all" | "unread">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  
  // Pin Modal States
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<"hide" | "unhide">("hide");
  const [tagPickerConv, setTagPickerConv] = useState<any>(null);
  const [pinTargetConvId, setPinTargetConvId] = useState<string | null>(null);

  useEffect(() => {
    if (checkSessionStatus) checkSessionStatus();
    loadLocalData();
  }, []);

  useEffect(() => {
    setActiveTab(normalizeHomeTab(directParams?.tab || initialTab));
  }, [directParams?.tab, initialTab]);

  const normalizeEmail = (email: string) => String(email || "").trim().toLowerCase();

  const getDisplayName = (email: string) => {
    if (!email) return t('common.user');
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail === "bot@unichat.system") return "UniChat Bot";
    if (normalizedEmail === normalizeEmail(user?.email)) {
      return user?.nickname || user?.fullName || user?.fullname || t('common.you');
    }
    const p = userProfiles[normalizedEmail] || {};
    return p?.nickname || p?.fullName || p?.fullname || normalizedEmail;
  };

  const getDisplayAvatar = (email?: string) => {
    const normalizedEmail = email ? normalizeEmail(email) : "";
    if (!normalizedEmail) return DEFAULT_AVATAR;
    if (normalizedEmail === "bot@unichat.system") return { uri: "https://api.dicebear.com/9.x/bottts/png?seed=UniChat&backgroundColor=0284c7" };
    if (normalizedEmail === normalizeEmail(user?.email)) {
       return user?.avatarUrl ? { uri: user.avatarUrl } : DEFAULT_AVATAR;
    }
    const profile = userProfiles[normalizedEmail] || {};
    const avatarUri = profile?.avatarUrl || profile?.urlAvatar || profile?.avatar;
    return avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;
  };

  const getConversationPreview = (conv: Conversation) => {
    const isMe = conv?.lastMessageSenderId === user?.email;
    const prefix = isMe ? t('common.you_colon') : '';

    // Create a mock message object to use getMessagePreview
    const mockMsg = {
      content: conv?.lastMessageContent || (String(conv?.lastMessage || '').startsWith('MSG#') ? '' : conv?.lastMessage) || '',
      type: (conv as any).lastMessageType,
      media: (conv as any).lastMessageMedia,
      files: (conv as any).lastMessageFiles,
    };

    const preview = getMessagePreview(mockMsg);
    if (preview === t('chat.message_label') && !mockMsg.content) return t('chat.no_messages');
    
    return `${prefix}${preview}`;
  };

  const onRefresh = useCallback(async () => {
    refetchConversations();
  }, [refetchConversations]);

  const fetchConversationsData = useCallback(async () => {
    if (user?.email) {
      await fetchConversations();
      setLoadingConversations(false);
    }
  }, [user?.email, fetchConversations]);

  useEffect(() => {
    fetchConversationsData();
  }, [fetchConversationsData]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Hide conversations with the bot
      const hasBot = Array.isArray(conv.members) && conv.members.some((m: string) => {
        const normalized = String(m || "").toLowerCase();
        const lowerBotEmail = BOT_EMAIL.toLowerCase();
        return normalized === lowerBotEmail || normalized.includes(lowerBotEmail) || normalized.includes('bot@unichat.system');
      });
      if (hasBot) return false;

      // 1. Unread filter
      if (chatFilter === "unread" && (conv.unreadCount || 0) === 0) return false;

      // 2. Tag filter
      if (tagFilter) {
        if (tagFilter === "none" && conv.tagId) return false;
        if (tagFilter !== "none" && conv.tagId !== tagFilter) return false;
      }

      // 3. Hidden conversations
      if (hiddenConversations[conv.id]) return false;

      return true;
    });
  }, [conversations, chatFilter, tagFilter, hiddenConversations]);

  const handleSelectChat = (chat: Conversation) => {
    if (chat.id === "CONV#SYSTEM") {
      navigation.navigate("SecurityAlerts");
      return;
    }
    navigation.navigate('Chat', { conversationId: chat.id });
  };

  const handleLogoutPress = () => {
    Alert.alert(t('profile.logout'), t('profile.logout_confirm'), [
      { text: t('common.cancel'), style: "cancel" },
      { text: t('profile.logout'), style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {activeTab !== "contacts" && (
        <HomeHeader 
          searchEmail={friendSearchEmail}
          onSearchPress={() => navigation.navigate('Search')}
          onQRScannerPress={() => navigation.navigate('QRScanner')}
          onAddPress={() => setIsAddMenuOpen(true)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          {activeTab === "chat" && (
            <>
              {/* Filter Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
                <TouchableOpacity onPress={() => setChatFilter("all")}>
                  <Text style={[chatFilter === "all" ? { color: colors.primary, fontWeight: '700' } : { color: colors.onSurfaceVariant, fontWeight: '500' }]}>{t('home.all')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChatFilter("unread")} style={{ marginLeft: 20 }}>
                  <Text style={[chatFilter === "unread" ? { color: colors.primary, fontWeight: '700' } : { color: colors.onSurfaceVariant, fontWeight: '500' }]}>{t('home.unread')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setClassifyOpen(true)} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: tagFilter ? colors.primary : colors.onSurfaceVariant, fontWeight: '500', marginRight: 4 }}>{t('home.classify')}</Text>
                  <Text style={{ fontFamily: 'Material Symbols Outlined', color: tagFilter ? colors.primary : colors.onSurfaceVariant, fontSize: 18 }}>filter_list</Text>
                </TouchableOpacity>
              </View>

              <ConversationList 
                conversations={filteredConversations}
                loading={loadingConversations}
                currentUserEmail={user?.email || ""}
                userProfiles={userProfiles}

                tags={tags}
                onSelectChat={handleSelectChat}
                onLongPressChat={(chat) => {
                  setActionConv(chat);
                }}
                getDisplayName={getDisplayName}
                getDisplayAvatar={getDisplayAvatar}
                getConversationPreview={getConversationPreview}
              />
            </>
          )}
          {activeTab === "contacts" && (
            <ContactsScreen
              user={user}
              conversations={conversations}
              onNavigate={(screen: string, p: any) => navigation.navigate(screen, p)}
              onOpenDirectChat={(email: string) => navigation.navigate('Chat', { targetEmail: email })}
              onOpenGroupConversation={(conv: any) => navigation.navigate('Chat', { conversationId: conv.id })}
            />
          )}
          {activeTab === "notifications" && <NotificationScreen onNavigate={(s: string, p: any) => navigation.navigate(s, p)} />}
          {activeTab === "profile" && (
            <ProfileTab 
              user={user}
              profileVersion={profileVersion}
              onNavigate={(s: string, p: any) => navigation.navigate(s, p)}
              onLogoutPress={handleLogoutPress}
              conversationFiles={[]}
              getFileIcon={() => "insert_drive_file"}
              formatFileSize={() => "0 KB"}
              DEFAULT_AVATAR={DEFAULT_AVATAR}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <MessageActionSheet 
        isVisible={!!actionMessage}
        message={actionMessage}
        userEmail={user?.email || ""}
        onClose={() => setActionMessage(null)}
        onReact={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onForward={() => {}}
        onPin={() => {}}
        onRecall={() => {}}
        onDeleteForMe={() => {}}
      />

      <InboxActionSheet 
        isVisible={!!actionConv}
        conversation={actionConv}
        onClose={() => setActionConv(null)}
        onPin={async (convId, isPinned) => {
          setActionConv(null);
          await useChatStore.getState().setPinConversation(convId, !isPinned);
        }}
        onClassify={() => {
          const targetConv = actionConv;
          setActionConv(null);
          setTimeout(() => {
            setTagPickerConv(targetConv);
            setTagPickerOpen(true);
          }, 150);
        }}
        onHideToggle={(convId, isHidden) => {
          setActionConv(null);
          setTimeout(() => {
            setPinTargetConvId(convId);
            setPinModalMode(isHidden ? "unhide" : "hide");
            setPinModalVisible(true);
          }, 150);
        }}
        onManageTags={() => {
          setActionConv(null);
          setTimeout(() => {
            navigation.navigate('TagManagement');
          }, 150);
        }}
      />

      <ClassifyFilterModal
        isVisible={classifyOpen}
        currentTag={tagFilter}
        onClose={() => setClassifyOpen(false)}
        onSelectFilter={setTagFilter}
        onManageTags={() => {
          setClassifyOpen(false);
          navigation.navigate('TagManagement');
        }}
      />

      <ConversationTagPicker
        isVisible={tagPickerOpen}
        conversation={tagPickerConv}
        onClose={() => {
          setTagPickerOpen(false);
          setTimeout(() => setTagPickerConv(null), 300); // clear after animation
        }}
        onAssignTag={(convId, tagId) => {
          useChatStore.getState().assignTagToConversation(convId, tagId);
        }}
        onManageTags={() => {
          navigation.navigate('TagManagement');
        }}
      />

      <PinModal
        isVisible={pinModalVisible}
        isSettingPin={pinModalMode === "hide"}
        onClose={() => setPinModalVisible(false)}
        onSubmit={(pin) => {
          if (pinTargetConvId) {
            if (pinModalMode === "hide") {
              useChatStore.getState().hideConversationWithPin(pinTargetConvId, pin);
            } else {
              const success = useChatStore.getState().unhideConversationWithPin(pinTargetConvId, pin);
              if (!success) {
                // If it was a real app we would show an alert, but for now we just log
                console.warn("Sai mã PIN");
              }
            }
          }
          setPinModalVisible(false);
        }}
      />

      <Modal
        visible={isAddMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddMenuOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAddMenuOpen(false)}>
          <View style={[styles.addMenu, { top: insets.top + 50 }]}>
            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => { setIsAddMenuOpen(false); navigation.navigate('Search'); }}
            >
              <Text style={styles.addMenuIcon}>person_add</Text>
              <Text style={styles.addMenuLabel}>{t('home.add_friend')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => { setIsAddMenuOpen(false); navigation.navigate('CreateGroup'); }}
            >
              <Text style={styles.addMenuIcon}>group_add</Text>
              <Text style={styles.addMenuLabel}>{t('home.create_group')}</Text>
            </TouchableOpacity>

            <View style={styles.addMenuDivider} />

            <TouchableOpacity style={styles.addMenuItem}>
              <Text style={styles.addMenuIcon}>videocam</Text>
              <Text style={styles.addMenuLabel}>{t('home.create_group_call')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addMenuItem}>
              <Text style={styles.addMenuIcon}>devices</Text>
              <Text style={styles.addMenuLabel}>{t('home.login_devices')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

